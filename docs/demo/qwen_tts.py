"""
Generate the demo narration with Qwen3-TTS on the GPU box.

Runs on the remote machine inside the Qwen3-TTS venv. Speaks each subtitle cue
in the cloned voice and writes one wav per cue, named by cue number. Fitting to
the cue windows happens later with ffmpeg, so this stays ignorant of the video.

Cloning runs in x-vector mode by default, which takes the voice's timbre from
the reference without needing an exact transcript of it. Pass --ref-text to use
in-context mode instead, which is usually a little closer to the original but
only if the transcript really matches the audio.

    .venv\\Scripts\\python.exe qwen_tts.py --only 2
    .venv\\Scripts\\python.exe qwen_tts.py
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
    ap.add_argument("--ref-text", default="")
    ap.add_argument("--model", default="models/base")
    ap.add_argument("--out", default="cues")
    ap.add_argument("--only", type=int, default=0)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cues = parse_srt(Path(args.srt))
    if args.only:
        cues = [c for c in cues if c[0] == args.only]

    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    print(f"cuda {torch.cuda.is_available()}", flush=True)
    print("loading model...", flush=True)
    tts = Qwen3TTSModel.from_pretrained(
        args.model,
        device_map="cuda:0",
        dtype=torch.bfloat16,
        # flash-attention is not built for Windows here; sdpa is in core torch.
        attn_implementation="sdpa",
    )
    print("model loaded", flush=True)

    xvec_only = not args.ref_text
    # Build the speaker prompt once and reuse it for every cue, so the voice
    # cannot drift between lines.
    prompt = tts.create_voice_clone_prompt(
        ref_audio=args.ref,
        ref_text=args.ref_text or "",
        x_vector_only_mode=xvec_only,
    )
    print(f"voice prompt ready (x_vector_only={xvec_only})", flush=True)

    gen = dict(
        max_new_tokens=2048,
        do_sample=True,
        top_k=50,
        top_p=1.0,
        # Lower than the sample default: this is level narration, not acting.
        temperature=0.7,
        repetition_penalty=1.05,
        subtalker_dosample=True,
        subtalker_top_k=50,
        subtalker_top_p=1.0,
        subtalker_temperature=0.7,
    )

    for index, start, end, text in cues:
        window = end - start
        t0 = time.time()
        wavs, sr = tts.generate_voice_clone(
            text=text,
            language="English",
            voice_clone_prompt=prompt,
            **gen,
        )
        wav = wavs[0]
        dest = out / f"{index:02d}.wav"
        sf.write(str(dest), wav, sr)
        spoken = len(wav) / sr
        print(
            f"cue {index:02d}  window {window:5.1f}s  spoken {spoken:5.1f}s  "
            f"({time.time() - t0:4.1f}s to make)",
            flush=True,
        )

    print("ALL CUES DONE", flush=True)


if __name__ == "__main__":
    main()
