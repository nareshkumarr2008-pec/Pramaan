"""
Combines the seed dataset with real logged usage (backend/data/training_log.jsonl,
written by backend/src/lib/claude.js when LOG_TRAINING_DATA=true) into a single
chat-formatted JSONL ready for fine-tuning.

Usage:
    python build_dataset.py --out ai-engine/data/train.jsonl

Dedupes near-identical (system, user) pairs, keeping the most recent response,
so retraining periodically on a growing log doesn't blow up with repeats.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # setu-ai/
SEED_PATH = ROOT / "ai-engine" / "data" / "seed.jsonl"
LOG_PATH = ROOT / "backend" / "data" / "training_log.jsonl"


def load_jsonl(path):
    if not path.exists():
        return []
    out = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def to_chat_example(rec):
    """Convert {"system","user","response"} into the chat-template format
    Unsloth/TRL's SFTTrainer expects, with the assistant turn being strict
    JSON text (matching exactly what the backend will parse at inference time)."""
    response_text = json.dumps(rec["response"], ensure_ascii=False)
    return {
        "messages": [
            {"role": "system", "content": rec["system"]},
            {"role": "user", "content": rec["user"]},
            {"role": "assistant", "content": response_text},
        ]
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "ai-engine" / "data" / "train.jsonl"))
    ap.add_argument("--min-examples-warning", type=int, default=100,
                     help="Print a warning if the combined dataset is smaller than this.")
    args = ap.parse_args()

    seed = load_jsonl(SEED_PATH)
    logged = load_jsonl(LOG_PATH)
    print(f"Seed examples: {len(seed)}")
    print(f"Logged real-usage examples: {len(logged)}")

    combined = seed + logged
    seen = {}
    for rec in combined:
        key = (rec.get("system", "").strip(), rec.get("user", "").strip())
        seen[key] = rec  # later entries (logged, appended after seed) win on collision

    final = [to_chat_example(rec) for rec in seen.values()]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for ex in final:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    print(f"Wrote {len(final)} deduped training examples to {out_path}")
    if len(final) < args.min_examples_warning:
        print(
            f"\nNote: {len(final)} examples is enough to prove the pipeline works, but for a model you actually "
            f"trust in production, aim for 300-1000+ per task. Let the app run for a while with "
            f"LOG_TRAINING_DATA=true (using the existing Claude-backed path) to accumulate real examples, then "
            f"rerun this script and retrain — quality will climb a lot faster from real usage than from more "
            f"hand-written seed data."
        )


if __name__ == "__main__":
    main()
