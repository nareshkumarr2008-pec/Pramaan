require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const workerRoutes = require("./routes/workers");
const jobRoutes = require("./routes/jobs");
const applicationRoutes = require("./routes/applications");
const trialRoutes = require("./routes/trials");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (req, res) => {
  const provider = process.env.AI_PROVIDER === "local" ? "local" : "cloud";
  let aiConfigured = false;
  if (provider === "cloud") {
    aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  } else {
    // "configured" for local mode means Ollama is actually reachable right now,
    // not just that the env vars are set — that's the failure mode people hit.
    try {
      const url = `${process.env.LOCAL_AI_URL || "http://localhost:11434"}/api/tags`;
      const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
      aiConfigured = r.ok;
    } catch {
      aiConfigured = false;
    }
  }
  res.json({
    ok: true,
    aiProvider: provider,
    aiConfigured,
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/trials", trialRoutes);
app.use("/api/admin", adminRoutes);

// In production, serve the built frontend from ../frontend/dist
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error." });
});

app.listen(PORT, () => {
  console.log(`Setu.AI backend listening on http://localhost:${PORT}`);
  const provider = process.env.AI_PROVIDER === "local" ? "local" : "cloud";
  if (provider === "cloud" && !process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠  AI_PROVIDER=cloud but ANTHROPIC_API_KEY is not set — AI features will return 503 until you add it to backend/.env");
  }
  if (provider === "local") {
    console.log(`ℹ  AI_PROVIDER=local — expecting Ollama at ${process.env.LOCAL_AI_URL || "http://localhost:11434"} serving model "${process.env.LOCAL_AI_MODEL || "setu-ai"}". Check GET /api/health to confirm it's reachable.`);
  }
});
