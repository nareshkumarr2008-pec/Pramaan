const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Every route below is admin-only.
router.use(requireAuth, requireRole("admin"));

function rowToUser(r) {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    uiLanguage: r.ui_language,
    createdAt: r.created_at,
  };
}

function rowToJob(r) {
  return {
    id: r.id,
    postedBy: r.posted_by,
    shopName: r.shop_name,
    sector: r.sector,
    location: r.location,
    wageBand: r.wage_band,
    role: r.role,
    requiredTrade: r.required_trade,
    createdAt: r.created_at,
  };
}

// All accounts on the platform (workers, MSME owners, and other admins).
router.get("/users", (req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  res.json(rows.map(rowToUser));
});

// Remove a worker or MSME account and everything tied to it. Admin accounts
// (including your own) can't be deleted from here to avoid locking the
// platform out of an admin.
router.delete("/users/:username", (req, res) => {
  const uname = String(req.params.username).trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(uname);
  if (!user) return res.status(404).json({ error: "Account not found." });
  if (user.role === "admin") {
    return res.status(400).json({ error: "Admin accounts can't be deleted here." });
  }

  const tx = db.transaction((username, role) => {
    if (role === "worker") {
      const workerIds = db.prepare("SELECT id FROM workers WHERE owner_username = ?").all(username).map((w) => w.id);
      for (const id of workerIds) {
        db.prepare("DELETE FROM trials WHERE worker_id = ?").run(id);
      }
      db.prepare("DELETE FROM applications WHERE worker_username = ?").run(username);
      db.prepare("DELETE FROM workers WHERE owner_username = ?").run(username);
    } else if (role === "msme") {
      const jobIds = db.prepare("SELECT id FROM jobs WHERE posted_by = ?").all(username).map((j) => j.id);
      for (const id of jobIds) {
        db.prepare("DELETE FROM trials WHERE job_id = ?").run(id);
        db.prepare("DELETE FROM applications WHERE job_id = ?").run(id);
      }
      db.prepare("DELETE FROM jobs WHERE posted_by = ?").run(username);
    }
    db.prepare("DELETE FROM users WHERE username = ?").run(username);
  });
  tx(uname, user.role);

  res.json({ ok: true, username: uname });
});

// MSME job postings ledger, with the shop's account details attached.
router.get("/msme", (req, res) => {
  const rows = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all();
  const owners = new Map(
    db.prepare("SELECT username, display_name FROM users WHERE role = 'msme'").all().map((u) => [u.username, u.display_name])
  );
  res.json(
    rows.map((r) => ({
      ...rowToJob(r),
      ownerDisplayName: owners.get(r.posted_by) || r.posted_by,
      applicantCount: db.prepare("SELECT COUNT(*) c FROM applications WHERE job_id = ?").get(r.id).c,
    }))
  );
});

// Take down a single MSME job posting.
router.delete("/msme/:id", (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!job) return res.status(404).json({ error: "Posting not found." });

  const tx = db.transaction((jobId) => {
    db.prepare("DELETE FROM trials WHERE job_id = ?").run(jobId);
    db.prepare("DELETE FROM applications WHERE job_id = ?").run(jobId);
    db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
  });
  tx(job.id);

  res.json({ ok: true, id: job.id });
});

module.exports = router;
