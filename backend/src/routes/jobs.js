const express = require("express");
const db = require("../db");
const { genId } = require("../lib/util");
const { callClaudeJSON } = require("../lib/ai");
const { requireAuth, requireRole } = require("../middleware/auth");
const { autoApplyForNewJob } = require("../lib/autoApply");

const router = express.Router();

function rowToJob(r) {
  return {
    id: r.id,
    postedBy: r.posted_by,
    shopName: r.shop_name,
    sector: r.sector,
    location: r.location,
    wageBand: r.wage_band,
    processDescription: r.process_description,
    role: r.role,
    requiredTrade: r.required_trade,
    skillsNeeded: JSON.parse(r.skills_needed_json),
    steps: JSON.parse(r.steps_json),
    quizQuestions: JSON.parse(r.quiz_json),
    createdAt: r.created_at,
  };
}

// AI-generated micro-training capsule from a free-text process description. Not persisted.
router.post("/capsule", requireAuth, requireRole("msme"), async (req, res) => {
  const { shopName, sector, location, wageBand, processDescription } = req.body || {};
  if (!shopName || !processDescription || processDescription.trim().length < 15) {
    return res.status(400).json({ error: "Add a shop name and describe the actual task in a sentence or two." });
  }
  try {
    const system =
      'You are a vocational trainer generating a micro-upskilling capsule for a new hire at an Indian MSME, based on the owner\'s description of the exact task, machine, or SOP. Return strict JSON only, no markdown. Schema: {"role": short job title, "requiredTrade": closest matching trade name, "skillsNeeded": array of 3-5 short tags, "steps": array of 4-6 objects {"title": short imperative title, "instruction": one to two sentences specific to what the owner described}, "quizQuestions": array of 2-3 objects {"question": string, "answer": string}}. Never write generic trade advice — every step must trace back to specific details the owner gave.';
    const user = `MSME name: ${shopName}\nSector: ${sector || "not given"}\nLocation: ${location || "not given"}\nWage band: ${wageBand || "not given"}\nOwner's description of the exact task/machine/SOP: "${processDescription.trim()}"\n\nGenerate the capsule as JSON.`;
    const result = await callClaudeJSON(system, user);
    res.json(result);
  } catch (e) {
    handleAiError(res, e);
  }
});

// Persist a job posting (capsule already generated client-side from /capsule).
router.post("/", requireAuth, requireRole("msme"), (req, res) => {
  const {
    shopName, sector, location, wageBand, processDescription,
    role, requiredTrade, skillsNeeded, steps, quizQuestions,
  } = req.body || {};
  if (!shopName || !role) return res.status(400).json({ error: "Missing job data." });

  const id = genId("job");
  db.prepare(
    `INSERT INTO jobs (id, posted_by, shop_name, sector, location, wage_band, process_description, role, required_trade, skills_needed_json, steps_json, quiz_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user.username,
    shopName,
    sector || "",
    location || "Location not shared",
    wageBand || "Wage on discussion",
    processDescription || "",
    role,
    requiredTrade || "",
    JSON.stringify(skillsNeeded || []),
    JSON.stringify(steps || []),
    JSON.stringify(quizQuestions || []),
    Date.now()
  );
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  autoApplyForNewJob(job);
  res.json(rowToJob(job));
});

// Full network ledger (workers browse this).
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all();
  res.json(rows.map(rowToJob));
});

// My own postings, with applicant counts.
router.get("/mine", requireAuth, requireRole("msme"), (req, res) => {
  const rows = db.prepare("SELECT * FROM jobs WHERE posted_by = ? ORDER BY created_at DESC").all(req.user.username);
  const jobs = rows.map(rowToJob);
  const withApplicants = jobs.map((j) => {
    const applicants = db
      .prepare("SELECT worker_username, worker_name FROM applications WHERE job_id = ?")
      .all(j.id);
    return { ...j, applicants };
  });
  res.json(withApplicants);
});

// AI ranking of the network's workers against one of my job postings.
router.post("/:id/match", requireAuth, requireRole("msme"), async (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  if (job.posted_by !== req.user.username) return res.status(403).json({ error: "Not your posting." });

  const allWorkers = db.prepare("SELECT * FROM workers ORDER BY created_at DESC").all();
  if (!allWorkers.length) return res.json({ matches: [] });

  // Cap how many candidates go into the prompt. With the whole network
  // (now 70+ workers and growing) listed out, the prompt alone can exceed
  // a small/local model's context window — this shortlist keeps the
  // request a fixed, small size no matter how large the network gets.
  // Workers matching the job's trade go in first (they're the ones a
  // match is actually likely for), then the highest-scoring remainder
  // fills any leftover slots so the AI still has a full-size pool to rank.
  const MAX_CANDIDATES = 40;
  const jobTrade = (job.required_trade || "").trim().toLowerCase();
  const sameTrade = allWorkers.filter((w) => (w.trade || "").trim().toLowerCase() === jobTrade);
  const others = allWorkers
    .filter((w) => (w.trade || "").trim().toLowerCase() !== jobTrade)
    .sort((a, b) => b.score - a.score);
  const workers = [...sameTrade, ...others].slice(0, MAX_CANDIDATES);

  try {
    // Small/local models are unreliable at echoing back long opaque IDs
    // (worker_1789028092188_5dde2d59) verbatim in JSON — they truncate or
    // slightly mangle them, which silently drops every match. Give the model
    // a short 1-based index to reference instead, then map that back to the
    // real worker ourselves — far more robust across model sizes.
    const system =
      'You are a matching engine for an Indian labour marketplace. Given a job requirement and a numbered list of candidate workers with trade, skill score (0-900), location, and language, rank the best-fit candidates. Return strict JSON only: {"matches": array of up to 3 objects {"candidateIndex": integer (the candidate\'s number in the list), "matchScore": integer 0-100, "rationale": one short sentence citing score, trade fit, and location or language fit}}. Prefer higher skill score, matching trade, and matching or nearby location.';
    const user = `Job requirement:\nRole: ${job.role}\nSector: ${job.sector}\nLocation: ${job.location}\nSkills needed: ${JSON.parse(job.skills_needed_json).join(", ")}\n\nCandidates:\n${workers
      .map((w, i) => `${i + 1}. name:${w.name} | trade:${w.trade} | score:${w.score} | location:${w.location} | language:${w.language}`)
      .join("\n")}\n\nReturn ranked matches as JSON, using each candidate's number as candidateIndex.`;
    const result = await callClaudeJSON(system, user);

    const matches = (result.matches || [])
      .map((m) => ({ ...m, worker: workers[Number(m.candidateIndex) - 1] }))
      .filter((m) => m.worker)
      .map((m) => ({ ...m, worker: rowToWorkerPublic(m.worker) }));
    res.json({ matches });
  } catch (e) {
    handleAiError(res, e);
  }
});

function rowToWorkerPublic(r) {
  return { id: r.id, name: r.name, trade: r.trade, location: r.location, language: r.language, score: r.score };
}

function handleAiError(res, e) {
  if (e.code === "NO_API_KEY" || e.code === "LOCAL_AI_UNREACHABLE") return res.status(503).json({ error: e.message });
  // API_ERROR / BAD_JSON mean the AI server responded, just not usefully
  // (wrong/missing model, malformed output, etc.) — that message is
  // actionable, so show it instead of masking it behind the generic text.
  if (e.code === "API_ERROR" || e.code === "BAD_JSON") return res.status(502).json({ error: e.message });
  console.error(e);
  res.status(502).json({ error: "The AI engine couldn't complete that. Try again." });
}

module.exports = router;
