#!/usr/bin/env bash
# Converts the merged fine-tuned model into a quantized GGUF file and
# registers it with Ollama as "setu-ai" — the model your backend will call
# once AI_PROVIDER=local.
#
# Requires llama.cpp (for the GGUF converter + quantizer) and Ollama
# installed and on PATH. See README.md for one-time setup.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MERGED_DIR="$ROOT/output/setu-ai-merged"
GGUF_DIR="$ROOT/output/gguf"
QUANT="${QUANT:-Q4_K_M}"   # good default: ~4-bit, strong quality-vs-size tradeoff

mkdir -p "$GGUF_DIR"

if [ ! -d "$MERGED_DIR" ]; then
  echo "Merged model not found at $MERGED_DIR — run train.py first (with MERGE=True)." >&2
  exit 1
fi

if [ ! -d "$ROOT/llama.cpp" ]; then
  echo "Cloning llama.cpp for the GGUF conversion + quantization tools..."
  git clone --depth 1 https://github.com/ggml-org/llama.cpp "$ROOT/llama.cpp"
  pip install -r "$ROOT/llama.cpp/requirements.txt"
fi

echo "Converting merged model to GGUF (f16)..."
python "$ROOT/llama.cpp/convert_hf_to_gguf.py" "$MERGED_DIR" \
  --outfile "$GGUF_DIR/setu-ai-f16.gguf" --outtype f16

echo "Quantizing to $QUANT (this is what actually keeps GPU/VRAM use low at inference time)..."
"$ROOT/llama.cpp/build/bin/llama-quantize" \
  "$GGUF_DIR/setu-ai-f16.gguf" "$GGUF_DIR/setu-ai-$QUANT.gguf" "$QUANT"

echo "Registering the model with Ollama as 'setu-ai'..."
sed "s#{{GGUF_PATH}}#$GGUF_DIR/setu-ai-$QUANT.gguf#" "$ROOT/Modelfile.template" > "$ROOT/Modelfile"
ollama create setu-ai -f "$ROOT/Modelfile"

echo ""
echo "Done. Test it with:"
echo "  ollama run setu-ai"
echo "Then in backend/.env set AI_PROVIDER=local and restart the backend."
