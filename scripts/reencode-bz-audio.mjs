import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const course = JSON.parse(await readFile(join(ROOT, "src/data/ket-course.json"), "utf8"));
const outputDir = join(ROOT, "public/audio/uk");
const tempDir = await mkdtemp(join(tmpdir(), "ket-bz-audio-96k-"));
const jobs = course.entries.filter((entry) => entry.letter !== "A");
const concurrency = Math.max(1, Math.min(8, Number(process.env.KET_AUDIO_CONCURRENCY || 6)));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}\n${error}`)));
  });
}

let cursor = 0;
let completed = 0;

async function worker() {
  while (cursor < jobs.length) {
    const entry = jobs[cursor++];
    const source = join(outputDir, `${entry.slug}.mp3`);
    const target = join(tempDir, `${entry.slug}.mp3`);
    await run("ffmpeg", [
      "-y", "-loglevel", "error", "-i", source,
      "-map_metadata", "-1", "-c:a", "libmp3lame", "-b:a", "96k",
      "-ac", "1", "-ar", "44100", target,
    ]);
    completed += 1;
    if (completed % 100 === 0 || completed === jobs.length) {
      process.stdout.write(`\rRe-encoded ${completed}/${jobs.length} B–Z recordings`);
    }
  }
}

try {
  await Promise.all(Array.from({ length: concurrency }, worker));
  await Promise.all(jobs.map((entry) =>
    copyFile(join(tempDir, `${entry.slug}.mp3`), join(outputDir, `${entry.slug}.mp3`))
  ));
  process.stdout.write("\n");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
