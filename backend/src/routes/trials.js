const express = require("express");
const db = require("../db");
const { genId } = require("../lib/util");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, requireRole("msme"), (req, res) => {
  const { jobId, workerId, workerName } = req.body || {};
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  if (job.posted_by !== req.user.username) return res.status(403).json({ error: "Not your posting." });

  const id = genId("trial");
  db.prepare(
    `INSERT INTO trials (id, job_id, worker_id, worker_name, shop_name, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'in_progress', ?)`
  ).run(id, jobId, workerId, workerName, job.shop_name, Date.now());

  res.json({ id, jobId, workerId, status: "in_progress" });
});

router.get("/mine", requireAuth, requireRole("msme"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT trials.* FROM trials JOIN jobs ON trials.job_id = jobs.id WHERE jobs.posted_by = ? ORDER BY started_at DESC`
    )
    .all(req.user.username);
  res.json(rows);
});

module.exports = router;
