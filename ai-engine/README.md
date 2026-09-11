# Setu.AI's own model

This replaces the dependency on the Anthropic cloud API with a small model
**fine-tuned specifically on SETU.AI's four AI tasks**, running on your own
GPU:

1. Writing training capsules from an MSME owner's task description
2. Grading a worker's spoken skill-assessment transcript
3. Writing resumes in English / Hindi / Tamil
4. Ranking workers against a job posting

It is not a general chatbot — it only needs to be good at these four narrow,
structured jobs, which is exactly why a small fine-tuned model can do this
well while a giant general model would be overkill.

## Why fine-tuning, not training from zero

Training a language model from scratch needs internet-scale text and
thousands of GPU-days — not realistic on a personal machine. Fine-tuning
takes a small **already-trained** open-weight model (Qwen2.5-3B-Instruct by
default — picked for its English + Hindi + workable Tamil coverage) and uses
**LoRA/QLoRA** to teach it your exact four tasks and JSON schemas, on a
single consumer GPU, in a few hours. The result genuinely is "SETU.AI's own
model": it's a distinct set of weights you own, it runs fully offline, and
it costs nothing per call — but it's built on efficient reuse of
general language ability rather than reinventing it.

## The workflow

```
                 ┌─────────────────────────────────────────┐
Phase 1 (now)    │ seed.jsonl (13 hand-written examples,    │
                  │ covers all 4 tasks) → prove the pipeline │
                  └─────────────────────────────────────────┘
                                     │
Phase 2 (ongoing)│ Run the app normally with AI_PROVIDER=cloud
                  │ and LOG_TRAINING_DATA=true — every real   │
                  │ call gets logged to                       │
                  │ backend/data/training_log.jsonl for free  │
                  └─────────────────────────────────────────┘
                                     │
Phase 3           │ build_dataset.py merges seed + logs →     │
                  │ ai-engine/data/train.jsonl                │
                  └─────────────────────────────────────────┘
                                     │
Phase 4           │ train.py: QLoRA fine-tune on your GPU     │
                  └─────────────────────────────────────────┘
                                     │
Phase 5           │ export_gguf.sh: quantize + load into      │
                  │ Ollama as the "setu-ai" model              │
                  └─────────────────────────────────────────┘
                                     │
Phase 6           │ backend/.env: AI_PROVIDER=local            │
                  │ → app now runs on your own model,          │
                  │ zero cloud dependency                       │
                  └─────────────────────────────────────────┘
```

You can jump straight to Phase 4 using just the seed data to see the whole
pipeline work end to end today. For a model good enough to trust with real
users, let Phase 2 run for a while first — real usage data teaches the model
far more than hand-written examples can.

## One-command setup (on your GPU machine)

```bash
cd ai-engine
chmod +x setup_own_model.sh
./setup_own_model.sh
```

This runs every step below in order: installs dependencies, builds the seed
dataset, fine-tunes, quantizes, and registers the model with Ollama. Needs a
CUDA GPU with 8GB+ VRAM and internet access (to download the base model,
llama.cpp, and Ollama) — none of which a sandboxed environment has, so this
has to run on your own machine.

Prefer to run the steps individually, or understand what each one does
first? Keep reading below.

## One-time setup (manual, step by step)

```bash
# 1. Python environment for training
cd ai-engine
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. Ollama, for serving the finished model
curl -fsSL https://ollama.com/install.sh | sh
```

Needs a CUDA GPU with 8GB+ VRAM for the default 3B model in 4-bit. Less VRAM?
Set `BASE_MODEL=unsloth/Qwen2.5-1.5B-Instruct-bnb-4bit` as an env var before
running `train.py` — smaller model, less capable but even lighter.

## Running it

```bash
cd ai-engine

# Phase 1: seed data (one-time, already checked into data/seed.jsonl)
python data/build_seed_dataset.py

# Phase 3: merge seed + any logged real usage into training-ready format
python scripts/build_dataset.py

# Phase 4: fine-tune (writes ai-engine/output/setu-ai-lora and setu-ai-merged)
python train.py

# Phase 5: quantize to GGUF and register with Ollama as "setu-ai"
chmod +x export_gguf.sh
./export_gguf.sh

# Sanity check
ollama run setu-ai
```

Then in `backend/.env`:

```
AI_PROVIDER=local
LOCAL_AI_URL=http://localhost:11434
LOCAL_AI_MODEL=setu-ai
```

Restart the backend (`npm start`). All four AI routes
(`/jobs/capsule`, `/jobs/:id/match`, `/workers/assess`, `/workers/:id/resume`)
now run on your own model — check `backend/src/lib/ai.js`, which is the one
place that decides cloud vs. local, and `backend/src/lib/localAI.js`, which
is the client that talks to Ollama.

Switching back to the cloud API at any point is just `AI_PROVIDER=cloud`
again — nothing else changes, since both providers implement the identical
`callClaudeJSON(system, userPrompt, maxTokens)` interface.

## Keeping data collection running

Leave `LOG_TRAINING_DATA=true` in `backend/.env` even after switching to
`AI_PROVIDER=local` if you ever fall back to cloud for hard cases — every
successful call, from either provider path through `claude.js`, is fair game
for the next retrain. Periodically re-run Phase 3 and Phase 4 to retrain on
the growing dataset.

## Honest limits of this approach

- **Quality starts lower than Claude's.** A fine-tuned 3B model will not
  match a frontier model's judgment on edge cases (unusual trades, oddly
  phrased transcripts, ambiguous matches). It gets better as real logged
  data accumulates — budget for a few retrain cycles before fully trusting
  it in production.
- **JSON reliability is a bit lower** on a small model. `localAI.js` already
  retries once with a stricter instruction on a malformed response; if you
  see this firing a lot in logs, it's usually a sign the training set needs
  more examples of that particular task.
- **Tamil quality will likely lag English/Hindi** on the base model chosen
  here; adding more Tamil examples to the training set (real logs are the
  best source) narrows that gap fastest.
- **This is inference-only on your machine** — no data leaves your server at
  all once `AI_PROVIDER=local` is set, which is also a genuine privacy win
  over the cloud path.
