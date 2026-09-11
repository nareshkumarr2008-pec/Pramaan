/**
 * Single point of control for which AI engine SETU.AI's routes use.
 *
 * AI_PROVIDER=cloud (default) -> backend/src/lib/claude.js  (Anthropic API)
 * AI_PROVIDER=local           -> backend/src/lib/localAI.js (your fine-tuned
 *                                 model, served locally via Ollama)
 *
 * Routes should always `require("../lib/ai")`, never claude.js/localAI.js
 * directly, so switching providers is a one-line .env change.
 */
const provider = process.env.AI_PROVIDER === "local"
  ? require("./localAI")
  : require("./claude");

module.exports = { callClaudeJSON: provider.callClaudeJSON };
