const express = require("express");
const db = require("../db");
const { genId } = require("../lib/util");
const { callClaudeJSON } = require("../lib/ai");
const { requireAuth, requireRole } = require("../middleware/auth");
const { autoApplyForWorker } = require("../lib/autoApply");

const router = express.Router();

const RESUME_LANG_NAMES = { en: "English", hi: "Hindi", ta: "Tamil" };

function rowToWorker(r) {
  return {
    id: r.id,
    ownerUsername: r.owner_username,
    name: r.name,
    trade: r.trade,
    language: r.language,
    location: r.location,
    transcript: r.transcript,
    score: r.score,
    level: r.level,
    strengths: JSON.parse(r.strengths_json),
    gaps: JSON.parse(r.gaps_json),
    credentialSummary: r.credential_summary,
    autoApply: !!r.auto_apply,
    createdAt: r.created_at,
  };
}

// AI-graded practical skill assessment. Not persisted until POST /workers.
router.post("/assess", requireAuth, requireRole("worker"), async (req, res) => {
  const { trade, language, transcript } = req.body || {};
  if (!trade || !language || !transcript || transcript.trim().length < 15) {
    return res.status(400).json({ error: "Describe the task in at least a sentence or two." });
  }
  try {
    const system =
      'You are an experienced trade examiner for Indian MSME skilled trades. You evaluate a worker\'s spoken description of how they perform a task and produce a strict JSON object only, no markdown, no preamble. Schema: {"score": integer 0-900, "level": one of "Novice","Competent","Skilled","Master", "strengths": array of 2-3 short strings, "gaps": array of 1-2 short strings, "followUpQuestion": a short adaptive oral viva follow-up question probing the weakest point, "credentialSummary": one plain sentence suitable for a verifiable credential}. Be realistic: vague or generic answers score under 400; specific, technically correct, safety-aware answers score 700-900.';
    const user = `Trade: ${trade}\nLanguage spoken: ${language}\nWorker's spoken description (transcribed): "${transcript.trim()}"\n\nEvaluate and return only the JSON.`;
    const result = await callClaudeJSON(system, user);
    res.json(result);
  } catch (e) {
    handleAiError(res, e);
  }
});

// Persist a graded assessment as a verified worker profile.
router.post("/", requireAuth, requireRole("worker"), (req, res) => {
  const { trade, language, location, transcript, score, level, strengths, gaps, credentialSummary } = req.body || {};
  if (!trade || !language || score == null || !level) {
    return res.status(400).json({ error: "Missing assessment data." });
  }
  const id = genId("worker");
  db.prepare(
    `INSERT INTO workers (id, owner_username, name, trade, language, location, transcript, score, level, strengths_json, gaps_json, credential_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user.username,
    req.user.displayName,
    trade,
    language,
    location || "Location not shared",
    transcript || "",
    score,
    level,
    JSON.stringify(strengths || []),
    JSON.stringify(gaps || []),
    credentialSummary || "",
    Date.now()
  );
  const row = db.prepare("SELECT * FROM workers WHERE id = ?").get(id);
  res.json(rowToWorker(row));
});

// Full network ledger (public passport search + matching engine read from this).
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM workers ORDER BY created_at DESC").all();
  res.json(rows.map(rowToWorker));
});

// My own profiles only.
router.get("/mine", requireAuth, requireRole("worker"), (req, res) => {
  const rows = db
    .prepare("SELECT * FROM workers WHERE owner_username = ? ORDER BY created_at DESC")
    .all(req.user.username);
  res.json(rows.map(rowToWorker));
});

// Toggle auto-apply for one of my own profiles. When switched on, this
// immediately sweeps every job currently live on the network and applies
// to every one that matches this profile's trade or skills (see
// lib/autoApply.js) — so "on" means "applied everywhere it already fits,"
// not just "will apply to postings from now on." New postings continue to
// trigger the same matching automatically as they're created.
router.patch("/:id/auto-apply", requireAuth, requireRole("worker"), (req, res) => {
  const { enabled } = req.body || {};
  const row = db.prepare("SELECT * FROM workers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Profile not found." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Not your profile." });

  db.prepare("UPDATE workers SET auto_apply = ? WHERE id = ?").run(enabled ? 1 : 0, row.id);
  const updated = db.prepare("SELECT * FROM workers WHERE id = ?").get(row.id);
  if (enabled) autoApplyForWorker(updated);
  res.json(rowToWorker(updated));
});

// Public single-credential lookup — powers the public "Verify Credential" page
// (QR code / shareable link). No auth: that's the whole point of a portable,
// independently verifiable credential. Must stay after "/mine" so that path
// isn't swallowed by this catch-all :id param.
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM workers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No credential found with that ID." });
  res.json(rowToWorker(row));
});

// AI-generated resume in the requested language, built from a saved profile.
router.post("/:id/resume", requireAuth, requireRole("worker"), async (req, res) => {
  const { lang } = req.body || {};
  const row = db.prepare("SELECT * FROM workers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Profile not found." });
  if (row.owner_username !== req.user.username) return res.status(403).json({ error: "Not your profile." });

  const langName = RESUME_LANG_NAMES[lang] || "English";
  try {
    const system = `You write concise, professional one-page resumes for skilled tradespeople applying to Indian MSMEs. Write the ENTIRE resume content in ${langName}, using natural, correctly spelled vocabulary a native reader would expect (script: ${lang === "hi" ? "Devanagari" : lang === "ta" ? "Tamil" : "Latin"}). Return strict JSON only, no markdown, no preamble. Schema: {"fullName": string, "headline": short professional title, "summary": 2-3 sentences, "keySkills": array of 4-6 short strings, "experienceHighlights": array of 2-4 short strings framed as accomplishments, "credentialLine": one sentence citing the verified score, "contactNote": one short line, e.g. availability and location}.`;
    const user = `Worker name: ${row.name}\nTrade: ${row.trade}\nLocation: ${row.location}\nSkill Credit Score: ${row.score}/900 (${row.level})\nStrengths: ${JSON.parse(row.strengths_json).join("; ")}\nCredential summary: ${row.credential_summary}\n\nWrite the resume JSON in ${langName}.`;
    const result = await callClaudeJSON(system, user);
    res.json(result);
  } catch (e) {
    handleAiError(res, e);
  }
});

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
