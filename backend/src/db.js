const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "setu.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker','msme','admin')),
  ui_language TEXT NOT NULL DEFAULT 'en',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  owner_username TEXT NOT NULL REFERENCES users(username),
  name TEXT NOT NULL,
  trade TEXT NOT NULL,
  language TEXT NOT NULL,
  location TEXT NOT NULL,
  transcript TEXT NOT NULL,
  score INTEGER NOT NULL,
  level TEXT NOT NULL,
  strengths_json TEXT NOT NULL,
  gaps_json TEXT NOT NULL,
  credential_summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  posted_by TEXT NOT NULL REFERENCES users(username),
  shop_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  location TEXT NOT NULL,
  wage_band TEXT NOT NULL,
  process_description TEXT NOT NULL,
  role TEXT NOT NULL,
  required_trade TEXT NOT NULL,
  skills_needed_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  quiz_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  worker_username TEXT NOT NULL REFERENCES users(username),
  worker_name TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at INTEGER NOT NULL,
  UNIQUE(job_id, worker_username)
);

CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  worker_id TEXT NOT NULL REFERENCES workers(id),
  worker_name TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at INTEGER NOT NULL
);
`);

// Additive column migrations for databases created before these features
// existed. ADD COLUMN is safe to run repeatedly if guarded by a column
// existence check (unlike the users.role CHECK patch below, no rebuild
// needed since these are plain nullable/defaulted columns).
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("workers", "auto_apply", "auto_apply INTEGER NOT NULL DEFAULT 0");
ensureColumn("applications", "source", "source TEXT NOT NULL DEFAULT 'manual'");

// The users table may already exist from before the "admin" role was added,
// with an older CHECK (role IN ('worker','msme')) constraint baked in —
// CREATE TABLE IF NOT EXISTS above won't touch it. Detect that and patch the
// stored schema text in place (via sqlite_master) so admin accounts can be
// inserted, without rebuilding the table — which matters because workers,
// jobs, applications, and trials all carry live foreign keys to
// users(username), and a rename-based rebuild would silently repoint those
// at a temp table name that then gets dropped.
const usersSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
if (usersSchema && !usersSchema.sql.includes("'admin'")) {
  const patchedSql = usersSchema.sql.replace(
    "CHECK (role IN ('worker','msme'))",
    "CHECK (role IN ('worker','msme','admin'))"
  );
  if (patchedSql !== usersSchema.sql) {
    // better-sqlite3 blocks direct writes to sqlite_master (and setting
    // schema_version) unless "unsafe mode" is explicitly enabled — there is
    // no PRAGMA for this in better-sqlite3's bundled SQLite; it's exposed
    // only via db.unsafeMode(). writable_schema alone is not enough.
    db.unsafeMode(true);
    db.pragma("writable_schema = ON");
    db.prepare("UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = 'users'").run(patchedSql);
    db.pragma("writable_schema = OFF");
    // The schema cache needs a fresh read after a raw sqlite_master edit.
    db.pragma("schema_version = " + (db.pragma("schema_version", { simple: true }) + 1));
    db.unsafeMode(false);
  }
}

module.exports = db;
