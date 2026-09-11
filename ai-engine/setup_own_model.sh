#!/usr/bin/env bash
# One-command setup for SETU.AI's own model. Run this ON YOUR GPU MACHINE
# (this cannot run in a sandboxed/CI environment — it needs a real GPU and
# internet access to download the base model + llama.cpp + Ollama).
#
# What it does, in order:
#   1. Installs the Python fine-tuning dependencies
#   2. Builds the seed dataset (13 hand-written examples across all 4 tasks)
#   3. Merges seed + any real logged usage into train.jsonl
#   4. Fine-tunes the base model with QLoRA (writes output/setu-ai-lora + setu-ai-merged)
#   5. Quantizes to GGUF and registers the result with Ollama as "setu-ai"
#
# After this finishes, set AI_PROVIDER=local in backend/.env and restart the backend.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "=== SETU.AI own-model setup ==="

if ! command -v nvidia-smi &> /dev/null; then
  echo "WARNING: nvidia-smi not found — no NVIDIA GPU detected. Training will be extremely slow or fail." >&2
  read -p "Continue anyway? [y/N] " confirm
  [[ "$confirm" == "y" || "$confirm" == "Y" ]] || exit 1
fi

echo ""
echo "--- Step 1/5: Python environment ---"
if [ ! -d venv ]; then
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt

echo ""
echo "--- Step 2/5: Building seed dataset ---"
python data/build_seed_dataset.py

echo ""
echo "--- Step 3/5: Merging seed + logged real-usage data ---"
python scripts/build_dataset.py

echo ""
echo "--- Step 4/5: Fine-tuning (this is the long step — watch for OOM errors) ---"
python train.py

echo ""
echo "--- Step 5/5: Quantizing and loading into Ollama ---"
if ! command -v ollama &> /dev/null; then
  echo "Ollama not found — installing..."
  curl -fsSL https://ollama.com/install.sh | sh
fi
chmod +x export_gguf.sh
./export_gguf.sh

echo ""
echo "=== Done ==="
echo "Test the model:      ollama run setu-ai"
echo "Then in backend/.env set:"
echo "  AI_PROVIDER=local"
echo "  LOCAL_AI_URL=http://localhost:11434"
echo "  LOCAL_AI_MODEL=setu-ai"
echo "Restart the backend (npm start) — SETU.AI now runs on your own model."
