const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { genId } = require("../lib/util");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", (req, res) => {
  const { username, password, displayName, role, uiLanguage } = req.body || {};
  if (!username || !password || !displayName || !role) {
    return res.status(400).json({ error: "Fill in every field to continue." });
  }
  if (!["worker", "msme"].includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  const uname = String(username).trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(uname);
  if (existing) return res.status(409).json({ error: "That username is already taken." });

  const id = genId("user");
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, ui_language, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, uname, passwordHash, String(displayName).trim(), role, uiLanguage || "en", Date.now());

  const user = { username: uname, role, display_name: displayName.trim() };
  res.json({ token: signToken(user), user: publicUser(user, uiLanguage) });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Incorrect username or password." });

  const uname = String(username).trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(uname);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  res.json({ token: signToken(row), user: publicUser(row, row.ui_language) });
});

router.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(req.user.username);
  if (!row) return res.status(404).json({ error: "Account not found." });
  res.json({ user: publicUser(row, row.ui_language) });
});

function publicUser(row, uiLanguage) {
  return {
    username: row.username,
    displayName: row.display_name || row.displayName,
    role: row.role,
    uiLanguage: uiLanguage || "en",
  };
}

module.exports = router;
