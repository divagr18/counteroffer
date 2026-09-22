"""
Narrate the demo in the maker's own cloned voice.

Reads docs/demo/vo_script.srt, generates one clip per cue with Chatterbox
(MIT-licensed, runs on CPU), fits each clip inside its own subtitle window so
the picture and the voice never drift apart, and lays the result over the
finished video as a real audio track.

The reference is the maker's own recorded narration, supplied by them.

    python docs/demo/voiceover.py --probe        # one cue, to judge the voice
    python docs/demo/voiceover.py                # all cues
    python docs/demo/voiceover.py --mux          # all cues + mux into the mp4
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRT = ROOT / "docs/demo/vo_script.srt"
REFERENCE = ROOT / "data/voice/reference.wav"
OUT = ROOT / "data/voice/cues"
VIDEO = ROOT / "data/demo-recording/final/counteroffer-demo.mp4"
NARRATED = ROOT / "data/demo-recording/final/counteroffer-demo-narrated.mp4"
FFMPEG = os.environ.get("FFMPEG_PATH", "C:/ffmpeg/bin/ffmpeg.exe")
# Only the executable name changes; replacing "ffmpeg" everywhere would rewrite
# the directory too.
FFPROBE = str(Path(FFMPEG).with_name(Path(FFMPEG).name.replace("ffmpeg", "ffprobe")))
SAMPLE_RATE = 24000


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def parse_srt(path):
    """Return [(index, start, end, text)] with times in seconds."""
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


def duration(path):
    out = subprocess.run(
        [
            FFPROBE,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(out.stdout.strip())


def fit(src, dst, window):
    """
    Fit a clip inside its cue window.

    Speaking rate is nudged rather than the audio being cut off: losing the end
    of a sentence is far more noticeable than a few percent of tempo. Anything
    beyond a quarter faster is left alone and simply allowed to run long, since
    that much compression sounds obviously processed.
    """
    have = duration(src)
    ratio = have / window if window > 0 else 1.0
    if ratio <= 1.0:
        run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", str(src),
             "-af", f"apad=pad_dur={window - have:.3f}", "-ar", str(SAMPLE_RATE),
             "-ac", "1", "-y", str(dst)])
        return have, window, 1.0
    tempo = min(ratio, 1.25)
    run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", str(src),
         "-af", f"atempo={tempo:.4f}", "-ar", str(SAMPLE_RATE), "-ac", "1",
         "-y", str(dst)])
    return have, duration(dst), tempo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true", help="generate one cue only")
    ap.add_argument("--cue", type=int, default=2, help="which cue to probe")
    ap.add_argument("--mux", action="store_true", help="lay the track over the video")
    ap.add_argument("--exaggeration", type=float, default=0.35)
    ap.add_argument("--cfg-weight", type=float, default=0.5)
    args = ap.parse_args()

    if not REFERENCE.exists():
        sys.exit(f"missing voice reference: {REFERENCE}")

    cues = parse_srt(SRT)
    OUT.mkdir(parents=True, exist_ok=True)

    import torch
    from chatterbox.tts import ChatterboxTTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"loading chatterbox on {device}")
    model = ChatterboxTTS.from_pretrained(device=device)
    print(f"reference: {REFERENCE.name} ({duration(REFERENCE):.1f}s)")

    selected = [c for c in cues if c[0] == args.cue] if args.probe else cues
    import torchaudio

    for index, start, end, text in selected:
        window = end - start
        raw = OUT / f"{index:02d}-raw.wav"
        final = OUT / f"{index:02d}.wav"
        wav = model.generate(
            text,
            audio_prompt_path=str(REFERENCE),
            exaggeration=args.exaggeration,
            cfg_weight=args.cfg_weight,
        )
        torchaudio.save(str(raw), wav, model.sr)
        spoken, fitted, tempo = fit(raw, final, window)
        flag = "" if tempo == 1.0 else f"  tempo {tempo:.2f}x"
        print(f"  cue {index:02d}  window {window:5.1f}s  spoken {spoken:5.1f}s{flag}")

    if args.probe:
        print(f"\nprobe written to {OUT / f'{args.cue:02d}.wav'}")
        return

    # Lay every cue at its own timestamp on one silent bed the length of the film.
    bed = OUT / "track.wav"
    total = duration(VIDEO)
    inputs, filters, labels = [], [], []
    for i, (index, start, _end, _t) in enumerate(cues):
        inputs += ["-i", str(OUT / f"{index:02d}.wav")]
        filters.append(f"[{i}:a]adelay={int(start * 1000)}|{int(start * 1000)}[a{i}]")
        labels.append(f"[a{i}]")
    graph = ";".join(filters) + ";" + "".join(labels) + f"amix=inputs={len(cues)}:normalize=0[out]"
    run([FFMPEG, "-hide_banner", "-loglevel", "error", *inputs,
         "-filter_complex", graph, "-map", "[out]", "-t", str(total),
         "-ar", "44100", "-ac", "1", "-y", str(bed)])
    print(f"track: {bed} ({duration(bed):.1f}s)")

    if args.mux:
        run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", str(VIDEO),
             "-i", str(bed), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-shortest", "-movflags", "+faststart", "-y", str(NARRATED)])
        print(f"NARRATED {NARRATED}")


if __name__ == "__main__":
    main()
