"""
Fine-tunes a small open-source base model into "SETU.AI's own model" —
one that only needs to be good at 4 things: writing training capsules,
grading skill assessments, writing resumes in en/hi/ta, and ranking
worker-job matches, all as strict JSON.

Base model: Qwen2.5-3B-Instruct by default. It's small enough to fine-tune
and run in 4-bit on a single consumer GPU (8GB+ VRAM), and has solid
English + Hindi coverage and workable Tamil coverage out of the box, which
QLoRA fine-tuning sharpens further for this specific domain. Swap
BASE_MODEL below for another instruct model (e.g. meta-llama/Llama-3.2-3B-Instruct)
if you prefer.

Usage:
    python build_seed_dataset.py            # data/seed.jsonl (one-time)
    python ../scripts/build_dataset.py       # data/train.jsonl
    python train.py

Output: a LoRA adapter in ai-engine/output/setu-ai-lora, plus (if MERGE=True)
a merged full-precision model in ai-engine/output/setu-ai-merged, ready for
GGUF conversion (see export_gguf.sh).
"""
import json
import os
from pathlib import Path

from datasets import load_dataset
from unsloth import FastLanguageModel
from trl import SFTTrainer, SFTConfig

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "train.jsonl"
OUTPUT_DIR = ROOT / "output" / "setu-ai-lora"
MERGED_DIR = ROOT / "output" / "setu-ai-merged"

BASE_MODEL = os.environ.get("BASE_MODEL", "unsloth/Qwen2.5-3B-Instruct-bnb-4bit")
MAX_SEQ_LEN = 2048           # capsule/resume/match prompts + JSON responses fit comfortably
LORA_RANK = 16                # keep it small: this model only needs to learn 4 narrow tasks
EPOCHS = 3
LEARNING_RATE = 2e-4
MERGE = True                  # merge LoRA into base weights for easy GGUF export


def main():
    if not DATA_PATH.exists():
        raise SystemExit(
            f"{DATA_PATH} not found. Run:\n"
            f"  python data/build_seed_dataset.py\n"
            f"  python ../scripts/build_dataset.py\nfirst."
        )

    print(f"Loading base model: {BASE_MODEL}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL,
        max_seq_length=MAX_SEQ_LEN,
        dtype=None,          # auto-detect
        load_in_4bit=True,   # keeps VRAM use low — this is the "limited resources" lever
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=LORA_RANK,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",  # further lowers VRAM use
        random_state=42,
    )

    dataset = load_dataset("json", data_files=str(DATA_PATH), split="train")

    def format_example(ex):
        text = tokenizer.apply_chat_template(ex["messages"], tokenize=False, add_generation_prompt=False)
        return {"text": text}

    dataset = dataset.map(format_example)
    print(f"Training examples: {len(dataset)}")

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LEN,
        args=SFTConfig(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            num_train_epochs=EPOCHS,
            learning_rate=LEARNING_RATE,
            warmup_ratio=0.05,
            logging_steps=5,
            optim="adamw_8bit",   # low-memory optimizer, pairs well with 4-bit base
            output_dir=str(OUTPUT_DIR),
            save_strategy="epoch",
            report_to="none",
        ),
    )

    trainer.train()

    print(f"Saving LoRA adapter to {OUTPUT_DIR}")
    model.save_pretrained(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))

    if MERGE:
        print(f"Merging adapter into base weights -> {MERGED_DIR}")
        model.save_pretrained_merged(str(MERGED_DIR), tokenizer, save_method="merged_16bit")

    print("\nDone. Next step: convert to GGUF and load into Ollama — see export_gguf.sh and README.md.")


if __name__ == "__main__":
    main()
