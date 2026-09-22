/**
 * Cut the captured takes into the finished demo.
 *
 * Reads edit.json — a list of {label, source, start, sourceDuration,
 * outDuration} — cuts each clip out of the raw Playwright recordings, remaps
 * its speed so a four-minute stretch of real work can land as eight seconds on
 * screen, then concatenates everything.
 *
 * Subtitles are never burned into the picture. The narration is written to
 * final/captions/ rather than next to the video, because a .srt sharing the
 * video's basename makes most players switch captions on by themselves, which
 * looks exactly like a burned-in track.
 *
 *   node docs/demo/assemble.cjs
 */

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, "../../data/demo-recording");
const FFMPEG = process.env.FFMPEG_PATH || "C:/ffmpeg/bin/ffmpeg.exe";
const EDIT = path.join(__dirname, "edit.json");
const SRT = path.join(__dirname, "vo_script.srt");

function run(args) {
  return new Promise((resolve, reject) =>
    execFile(FFMPEG, args, { windowsHide: true, maxBuffer: 4e6 }, (err, _out, stderr) =>
      err ? reject(new Error(stderr || err.message)) : resolve(),
    ),
  );
}

/** Length of the narration, so the picture cannot drift from the voice. */
function srtSeconds() {
  const text = fs.readFileSync(SRT, "utf8");
  const stamps = [...text.matchAll(/--> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)];
  const last = stamps[stamps.length - 1];
  return (
    Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]) + Number(last[4]) / 1000
  );
}

async function main() {
  const edl = JSON.parse(fs.readFileSync(EDIT, "utf8"));
  const total = edl.reduce((sum, c) => sum + c.outDuration, 0);
  const voice = srtSeconds();

  console.log(`timeline ${total.toFixed(1)}s | narration ${voice.toFixed(1)}s`);
  if (total + 0.5 < voice) {
    throw new Error(
      `timeline is ${(voice - total).toFixed(1)}s shorter than the narration`,
    );
  }

  const cuts = path.join(ROOT, "cuts");
  const out = path.join(ROOT, "final");
  fs.rmSync(cuts, { recursive: true, force: true });
  fs.mkdirSync(cuts, { recursive: true });
  fs.mkdirSync(out, { recursive: true });

  for (let i = 0; i < edl.length; i++) {
    const clip = edl[i];
    if (!fs.existsSync(clip.source)) {
      throw new Error(`missing source for "${clip.label}": ${clip.source}`);
    }
    const dest = path.join(cuts, `${String(i).padStart(2, "0")}.mp4`);
    const ratio = clip.outDuration / clip.sourceDuration;
    console.log(
      `  ${String(i).padStart(2, "0")} ${clip.label} — ${clip.sourceDuration}s -> ${clip.outDuration}s (${ratio.toFixed(2)}x)`,
    );
    await run([
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(clip.start),
      "-t",
      String(clip.sourceDuration),
      "-i",
      clip.source,
      "-an",
      "-vf",
      `setpts=${ratio}*(PTS-STARTPTS),scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p`,
      "-r",
      "30",
      "-fps_mode",
      "cfr",
      "-t",
      String(clip.outDuration),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "19",
      "-y",
      dest,
    ]);
  }

  const listFile = path.join(ROOT, "concat.txt");
  fs.writeFileSync(
    listFile,
    edl
      .map((_, i) =>
        `file '${path.join(cuts, `${String(i).padStart(2, "0")}.mp4`).replaceAll("\\", "/")}'`,
      )
      .join("\n"),
  );

  const video = path.join(out, "counteroffer-demo.mp4");
  await run([
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-y",
    video,
  ]);
  // Kept out of the video's own folder on purpose — see the note at the top.
  const captions = path.join(out, "captions");
  fs.mkdirSync(captions, { recursive: true });
  fs.copyFileSync(SRT, path.join(captions, "counteroffer-demo.srt"));

  console.log(`FINAL   ${video}`);
  console.log(`CAPTIONS ${path.join(captions, "counteroffer-demo.srt")}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
