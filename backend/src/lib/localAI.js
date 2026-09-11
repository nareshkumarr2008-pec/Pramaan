/**
 * Drop-in replacement for lib/claude.js — same exported function, same
 * (system, userPrompt, maxTokens) => Promise<object> signature — but calls
 * YOUR fine-tuned model served locally via Ollama instead of the Anthropic
 * API. No network egress, no per-token billing, no dependency on a cloud
 * vendor being up.
 *
 * Requires: Ollama running on your GPU machine with the SETU.AI model
 * loaded (see ai-engine/README.md for how to train + load it):
 *   ollama create setu-ai -f ai-engine/Modelfile
 *   ollama serve
 *
 * Set in backend/.env:
 *   AI_PROVIDER=local
 *   LOCAL_AI_URL=http://localhost:11434
 *   LOCAL_AI_MODEL=setu-ai
 */
const LOCAL_AI_URL = process.env.LOCAL_AI_URL || "http://localhost:11434";
const LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL || "setu-ai";

async function callOnce(system, userPrompt, maxTokens) {
  let response;
  try {
    response = await fetch(`${LOCAL_AI_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LOCAL_AI_MODEL,
        max_tokens: maxTokens,
        temperature: 0.2, // low temp: we want reliable JSON, not creative variety
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (networkErr) {
    // fetch throws (rather than returning a non-ok response) when nothing
    // is even listening on LOCAL_AI_URL — by far the most common cause of
    // this failing, so give it its own clear, actionable message instead
    // of letting it fall through to the generic JSON-parse error below.
    const err = new Error(
      `Couldn't reach the local AI engine at ${LOCAL_AI_URL}. Is Ollama running ("ollama serve") with the "${LOCAL_AI_MODEL}" model loaded ("ollama create ${LOCAL_AI_MODEL} -f ai-engine/Modelfile")?`
    );
    err.code = "LOCAL_AI_UNREACHABLE";
    throw err;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const err = new Error(`Local AI error ${response.status}: ${body.slice(0, 300)}`);
    err.code = "API_ERROR";
    throw err;
  }

  const data = await response.json();
  const text = (data.choices || [])
    .map((c) => c.message && c.message.content)
    .filter(Boolean)
    .join("\n")
    .trim();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean); // throws if not valid JSON; caller retries once
}

/**
 * Same contract as callClaudeJSON: returns a parsed JSON object or throws
 * an Error with a .code of NO_API_KEY / API_ERROR / BAD_JSON / LOCAL_AI_UNREACHABLE.
 * Small models are more prone to occasionally malformed JSON than a large
 * cloud model, so this retries once with a stricter reminder before giving up
 * — this alone fixes the large majority of small-model JSON slips without
 * costing meaningful extra latency (local inference, no per-token bill).
 * A dead/unreachable server is not something a retry can fix, so that case
 * skips the retry and fails immediately with its specific message.
 */
async function callLocalAIJSON(system, userPrompt, maxTokens = 1000) {
  try {
    return await callOnce(system, userPrompt, maxTokens);
  } catch (e) {
    if (e.code === "API_ERROR" || e.code === "LOCAL_AI_UNREACHABLE") throw e;
    try {
      const strictSystem =
        system + "\n\nIMPORTANT: Reply with ONLY the raw JSON object. No markdown fences, no explanation, no text before or after the JSON.";
      return await callOnce(strictSystem, userPrompt, maxTokens);
    } catch (e2) {
      if (e2.code === "LOCAL_AI_UNREACHABLE") throw e2;
      const err = new Error("Local model did not return valid JSON after retry.");
      err.code = "BAD_JSON";
      throw err;
    }
  }
}

module.exports = { callClaudeJSON: callLocalAIJSON };
