"""
Generate the demo narration with IndexTTS-2 on the GPU box.

Runs on the remote machine inside the index-tts uv environment. Reads the
subtitle file, speaks each cue in the cloned voice, and writes one wav per cue
named by its cue number. Fitting to the cue windows happens back on the laptop
with ffmpeg, so nothing here has to know about the video.

    uv run python remote_tts.py --srt vo_script.srt --ref reference.wav --out cues
    uv run python remote_tts.py ... --only 2        # single cue, to audition
"""

import argparse
import re
import time
from pathlib import Path


def parse_srt(path):
    stamp = re.compile(
        r"(\d\d):(\d\d):(\d\d),(\d\d\d)\s*-->\s*(\d\d):(\d\d):(\d\d),(\d\d\d)"
    )
    cues, block = [], []
    for line in path.read_text(encoding="utf-8").splitlines() + [""]:
        if line.strip():
            block.append(line)
            continue
        if len(block) >= 3:
            m = stamp.search(block[1])
            start = int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3]) + int(m[4]) / 1000
            end = int(m[5]) * 3600 + int(m[6]) * 60 + int(m[7]) + int(m[8]) / 1000
            cues.append((int(block[0]), start, end, " ".join(block[2:]).strip()))
        block = []
    return cues


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--srt", default="vo_script.srt")
    ap.add_argument("--ref", default="reference.wav")
    ap.add_argument("--out", default="cues")
    ap.add_argument("--only", type=int, default=0)
    ap.add_argument("--fp16", action="store_true", default=True)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cues = parse_srt(Path(args.srt))
    if args.only:
        cues = [c for c in cues if c[0] == args.only]

    print("importing indextts...", flush=True)
    from indextts.infer_v2 import IndexTTS2

    print("loading models...", flush=True)

    tts = IndexTTS2(
        cfg_path="checkpoints/config.yaml",
        model_dir="checkpoints",
        use_fp16=args.fp16,
        use_cuda_kernel=False,
        use_deepspeed=False,
        # The Qwen emotion model is only needed to infer emotion from text.
        # This narration is level on purpose, so skip loading it entirely.
        use_qwen_emo=False,
    )
    print("model loaded", flush=True)

    for index, start, end, text in cues:
        target = end - start
        dest = out / f"{index:02d}.wav"
        t0 = time.perf_counter()
        # emo_alpha below 1 keeps the delivery level: this is narration over a
        # product demo, not a performance.
        tts.infer(
            spk_audio_prompt=args.ref,
            text=text,
            output_path=str(dest),
            emo_alpha=0.6,
            interval_silence=120,
            verbose=False,
        )
        took = time.perf_counter() - t0
        print(f"cue {index:02d}  window {target:5.1f}s  generated in {took:5.1f}s  -> {dest}", flush=True)

    print("ALL CUES DONE", flush=True)


if __name__ == "__main__":
    main()
