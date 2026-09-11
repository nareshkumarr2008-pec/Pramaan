const fs = require("fs");
const path = require("path");

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const LOG_PATH = path.join(__dirname, "..", "..", "data", "training_log.jsonl");

/**
 * When LOG_TRAINING_DATA=true, every successful (system, user) -> response
 * triple is appended to backend/data/training_log.jsonl. This turns normal
 * production usage into a growing, real-world dataset you can later fine-tune
 * your own local model on (see ai-engine/). It's the cheapest way to get
 * training data that actually reflects your users — no extra API calls, no
 * extra tokens spent, just a log line written alongside a call you were
 * making anyway.
 */
function logTrainingExample(system, user, response) {
  if (process.env.LOG_TRAINING_DATA !== "true") return;
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify({ system, user, response }) + "\n");
  } catch (e) {
    console.error("Failed to write training log:", e.message);
  }
}

/**
 * Calls Claude with a system prompt + user prompt and expects the model to
 * return a single strict JSON object (no markdown fences, no preamble).
 * Throws if ANTHROPIC_API_KEY is missing or the model's output isn't valid JSON.
 */
async function callClaudeJSON(system, userPrompt, maxTokens = 1000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "ANTHROPIC_API_KEY is not set on the server. Add it to backend/.env to enable AI features."
    );
    err.code = "NO_API_KEY";
    throw err;
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const err = new Error(`Anthropic API error ${response.status}: ${body.slice(0, 300)}`);
    err.code = "API_ERROR";
    throw err;
  }

  const data = await response.json();
  const text = (data.content || [])
    .map((b) => b.text || "")
    .join("\n")
    .trim();
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    logTrainingExample(system, userPrompt, parsed);
    return parsed;
  } catch (e) {
    const err = new Error("Model did not return valid JSON.");
    err.code = "BAD_JSON";
    err.raw = text;
    throw err;
  }
}

module.exports = { callClaudeJSON };
