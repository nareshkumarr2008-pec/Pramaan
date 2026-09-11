/**
 * seed-test-accounts.js — creates a fixed, predictable batch of test
 * accounts for demoing/testing the marketplace at a known scale:
 *
 *   - 25 MSME owner accounts (msme01..msme25), each with exactly one
 *     live job posting
 *   - 25 worker accounts (worker01..worker25), each with exactly one
 *     verified, AI-graded Skill Credit Score profile
 *
 * All 50 accounts use the password:  setu123
 *
 * This is separate from scripts/seed.js (which seeds a larger, randomized
 * demo network) so you can run either independently. Safe to re-run —
 * existing usernames, postings, and profiles are left untouched rather
 * than duplicated.
 *
 * Usage:
 *   cd backend
 *   node scripts/seed-test-accounts.js
 */

const bcrypt = require("bcryptjs");
const db = require("../src/db");
const { genId } = require("../src/lib/util");

const PASSWORD = "setu123";

function upsertUser({ username, displayName, role, uiLanguage }) {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return;
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, ui_language, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(genId("user"), username, bcrypt.hashSync(PASSWORD, 10), displayName, role, uiLanguage, Date.now());
}

function insertWorker(w) {
  const existing = db.prepare("SELECT id FROM workers WHERE owner_username = ?").get(w.owner);
  if (existing) return existing.id;
  const id = genId("worker");
  db.prepare(
    `INSERT INTO workers (id, owner_username, name, trade, language, location, transcript, score, level, strengths_json, gaps_json, credential_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, w.owner, w.name, w.trade, w.language, w.location, w.transcript,
    w.score, w.level, JSON.stringify(w.strengths), JSON.stringify(w.gaps),
    w.credentialSummary, Date.now() - w.daysAgo * 86400000
  );
  return id;
}

function insertJob(j) {
  const existing = db.prepare("SELECT id FROM jobs WHERE posted_by = ?").get(j.owner);
  if (existing) return existing.id;
  const id = genId("job");
  db.prepare(
    `INSERT INTO jobs (id, posted_by, shop_name, sector, location, wage_band, process_description, role, required_trade, skills_needed_json, steps_json, quiz_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, j.owner, j.shopName, j.sector, j.location, j.wageBand, j.processDescription,
    j.role, j.requiredTrade, JSON.stringify(j.skillsNeeded), JSON.stringify(j.steps),
    JSON.stringify(j.quizQuestions), Date.now() - j.daysAgo * 86400000
  );
  return id;
}

// ---- Deterministic pseudo-random helpers (fixed seed → same data every run) ----
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min, max) { return min + Math.floor(rand() * (max - min + 1)); }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function pickN(arr, n) {
  const pool = [...arr], out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  return out;
}
const pad = (n) => String(n).padStart(2, "0");

const TRADES = [
  "Welder", "Electrician", "Tailor / Machine Operator", "Mason", "CNC Operator",
  "Fitter", "Plumber", "Carpenter", "Food Processing Operator", "Packaging Operator",
];
const SECTORS = [
  "Textiles & Garments", "Auto Components", "Food Processing", "Electronics Assembly",
  "Furniture & Woodwork", "Metal Fabrication", "Leather & Footwear", "Construction",
];
const PLACES = [
  ["Chennai", "TN"], ["Coimbatore", "TN"], ["Madurai", "TN"], ["Tiruppur", "TN"],
  ["Bengaluru", "KA"], ["Mysuru", "KA"], ["Mumbai", "MH"], ["Pune", "MH"],
  ["Lucknow", "UP"], ["Kanpur", "UP"], ["New Delhi", "DL"], ["Ahmedabad", "GJ"],
  ["Surat", "GJ"], ["Kolkata", "WB"], ["Hyderabad", "TS"], ["Jaipur", "RJ"],
  ["Ludhiana", "PB"], ["Gurugram", "HR"], ["Kochi", "KL"], ["Indore", "MP"],
];
const STATE_LANGUAGE = {
  TN: "Tamil", KA: "Kannada", MH: "Marathi", UP: "Hindi", DL: "Hindi", GJ: "Gujarati",
  WB: "Bengali", TS: "Telugu", RJ: "Hindi", PB: "Punjabi", HR: "Hindi", KL: "Malayalam", MP: "Hindi",
};
const FIRST_NAMES = [
  "Arjun", "Vikram", "Suresh", "Ramesh", "Ganesh", "Manoj", "Rajesh", "Sanjay", "Deepak", "Ashok",
  "Vijay", "Anil", "Sunil", "Prakash", "Mahesh", "Ravi", "Kiran", "Naveen", "Arun", "Bharat",
  "Priya", "Lakshmi", "Kavya", "Meena", "Sunita",
];
const LAST_NAMES = [
  "Kumar", "Sharma", "Singh", "Reddy", "Rao", "Naidu", "Patel", "Yadav", "Verma", "Gupta",
  "Nair", "Pillai", "Iyer", "Devi", "Mestri", "Raman", "Shetty", "Choudhary", "Mishra", "Das",
];
const SHOP_PREFIX = ["Sri", "Shree", "Om", "New", "Bharat", "National", "Jai", "Royal", "City", "United"];
const SHOP_CORE = [
  "Metal Works", "Garments", "Textiles", "Electricals", "Foods", "Furniture", "Fabricators",
  "Enterprises", "Industries", "Engineering Works",
];
const STRENGTH_POOL = [
  "Follows safety sequencing correctly", "Clean, consistent finish", "Good pre-run equipment checks",
  "Catches defects early", "Steady, repeatable technique", "Comfortable working from a verbal SOP",
  "Understands the reason behind each step, not just the steps",
];
const GAP_POOL = [
  "Limited exposure to advanced tooling", "Finishing consistency on longer runs",
  "Less familiar with newer machine variants", "Needs more practice under time pressure",
];
// All 25 land in Competent-or-above so every profile reads as a genuinely
// "verified and assessed" credential, not a borderline/failed attempt.
function scoreAndLevel() {
  const r = rand();
  if (r < 0.35) return { score: randInt(400, 649), level: "Competent" };
  if (r < 0.80) return { score: randInt(650, 799), level: "Skilled" };
  return { score: randInt(800, 900), level: "Master" };
}

const usedNames = new Set();
function uniqueName(trade) {
  let name;
  do { name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; } while (usedNames.has(`${name}|${trade}`));
  usedNames.add(`${name}|${trade}`);
  return name;
}

// ---- 25 worker accounts, each with one verified/assessed profile ----
const workerOwners = [];
for (let i = 1; i <= 25; i++) {
  const username = `worker${pad(i)}`;
  const trade = TRADES[(i - 1) % TRADES.length];
  const name = uniqueName(trade);
  const [city, state] = pick(PLACES);
  const language = STATE_LANGUAGE[state];
  const { score, level } = scoreAndLevel();

  upsertUser({ username, displayName: name, role: "worker", uiLanguage: pick(["en", "hi", "ta"]) });
  insertWorker({
    owner: username, name, trade, language, location: `${city}, ${state}`,
    transcript: `Describes the ${trade.toLowerCase()} process step by step, including pre-start checks and safety practice on the job.`,
    score, level,
    strengths: pickN(STRENGTH_POOL, randInt(2, 3)),
    gaps: pickN(GAP_POOL, randInt(1, 2)),
    credentialSummary: `Verified practical assessment for ${trade} work, graded ${level} (${score}/900).`,
    daysAgo: randInt(0, 60),
  });
  workerOwners.push(username);
}

// ---- 25 MSME accounts, each with exactly one live job posting ----
const msmeOwners = [];
for (let i = 1; i <= 25; i++) {
  const username = `msme${pad(i)}`;
  const sector = pick(SECTORS);
  const requiredTrade = TRADES[(i - 1) % TRADES.length];
  const [city, state] = pick(PLACES);
  const shopName = `${pick(SHOP_PREFIX)} ${pick(SHOP_CORE)}`;
  const wageLow = randInt(10, 22) * 1000;

  upsertUser({ username, displayName: shopName, role: "msme", uiLanguage: pick(["en", "hi", "ta"]) });
  insertJob({
    owner: username, shopName, sector, location: `${city}, ${state}`,
    wageBand: `₹${wageLow.toLocaleString("en-IN")}–${(wageLow + 4000).toLocaleString("en-IN")}/month`,
    processDescription: `Day-to-day ${requiredTrade.toLowerCase()} work on the shop floor, following the unit's standard process.`,
    role: `${requiredTrade} — ${sector}`,
    requiredTrade,
    skillsNeeded: pickN(STRENGTH_POOL, 3),
    steps: [
      { title: "Pre-shift check", instruction: `Confirm tools and materials for ${requiredTrade.toLowerCase()} work are ready before starting.` },
      { title: "Follow the SOP", instruction: "Work through the standard steps for this task in order, checking quality as you go." },
    ],
    quizQuestions: [{ question: "What do you check before starting the shift?", answer: "Tools, materials, and safety gear." }],
    daysAgo: randInt(0, 30),
  });
  msmeOwners.push(username);
}

console.log("Seed complete.");
console.log("");
console.log("Created (or already present):");
console.log("  25 MSME accounts, each with one live job posting:");
console.log("   ", msmeOwners.join(", "));
console.log("  25 worker accounts, each with a verified/assessed profile:");
console.log("   ", workerOwners.join(", "));
console.log("");
console.log("Password for all 50 accounts: setu123");
