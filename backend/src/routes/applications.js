const express = require("express");
const db = require("../db");
const { genId } = require("../lib/util");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, requireRole("worker"), (req, res) => {
  const { jobId } = req.body || {};
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });

  const existing = db
    .prepare("SELECT id FROM applications WHERE job_id = ? AND worker_username = ?")
    .get(jobId, req.user.username);
  if (existing) return res.status(409).json({ error: "You've already applied to this job." });

  const id = genId("application");
  db.prepare(
    `INSERT INTO applications (id, job_id, worker_username, worker_name, shop_name, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'applied', ?)`
  ).run(id, jobId, req.user.username, req.user.displayName, job.shop_name, Date.now());

  res.json({ id, jobId, status: "applied" });
});

router.get("/mine", requireAuth, requireRole("worker"), (req, res) => {
  const rows = db
    .prepare("SELECT * FROM applications WHERE worker_username = ? ORDER BY created_at DESC")
    .all(req.user.username);
  res.json(rows);
});

module.exports = router;
