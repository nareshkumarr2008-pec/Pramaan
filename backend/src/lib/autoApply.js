const db = require("../db");
const { genId } = require("./util");

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

function safeParseArray(json) {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

// Skill-based match: true if the job's trade matches the worker's trade, or
// if any of the job's required skill tags shows up in the worker's graded
// strengths / credential summary. This is what "based on the worker's
// skill" means here — not just an exact trade-string match.
function jobMatchesWorker(job, worker) {
  const jobTrade = normalize(job.required_trade);
  const workerTrade = normalize(worker.trade);
  if (jobTrade && workerTrade && jobTrade === workerTrade) return true;

  const skillsNeeded = safeParseArray(job.skills_needed_json).map(normalize).filter(Boolean);
  if (!skillsNeeded.length) return false;

  const strengths = safeParseArray(worker.strengths_json).map(normalize);
  const profileText = normalize([...strengths, worker.credential_summary, worker.transcript].join(" "));

  return skillsNeeded.some((skill) => profileText.includes(skill));
}

const insertApplication = db.prepare(
  `INSERT OR IGNORE INTO applications (id, job_id, worker_username, worker_name, shop_name, status, source, created_at)
   VALUES (?, ?, ?, ?, ?, 'applied', 'auto', ?)`
);

function applyWorkerToJob(worker, job) {
  insertApplication.run(genId("application"), job.id, worker.owner_username, worker.name, job.shop_name, Date.now());
}

// Called once, right after a new job is posted: apply on behalf of every
// worker profile that already has auto-apply on and whose skills match.
function autoApplyForNewJob(job) {
  const workers = db.prepare("SELECT * FROM workers WHERE auto_apply = 1").all();
  for (const w of workers) {
    if (jobMatchesWorker(job, w)) applyWorkerToJob(w, job);
  }
}

// Called once, right when a worker switches auto-apply on for a profile:
// sweep every job currently live on the network and apply to every one
// that matches, so turning it on means "already applied everywhere it
// fits," not just "will apply going forward."
function autoApplyForWorker(worker) {
  const jobs = db.prepare("SELECT * FROM jobs").all();
  for (const job of jobs) {
    if (jobMatchesWorker(job, worker)) applyWorkerToJob(worker, job);
  }
}

module.exports = { jobMatchesWorker, autoApplyForNewJob, autoApplyForWorker };
