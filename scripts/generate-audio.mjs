import { access, copyFile, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const data = JSON.parse(await readFile(join(ROOT, "src/data/ket-course.json"), "utf8"));
const outputDir = join(ROOT, "public/audio/uk");
const tempDir = await mkdtemp(join(tmpdir(), "ket-audio-"));
const rawDir = join(tempDir, "raw");
const readyDir = join(tempDir, "ready");
const VOICE = "en-GB-SoniaNeural";
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.KET_AUDIO_CONCURRENCY || 6)));
const requestedSlugs = new Set(process.argv.slice(2));

const spokenOverrides = new Map([
  ["a-an", "a, or an"],
  ["all-right-alright", "all right, or alright"],
  ["a-m", "A.M."],
  ["as-well-as", "as well as"],
  ["at-sign", "at sign"],
  ["barbecue-barbeque", "barbecue"],
  ["cafe-cafe", "café"],
  ["centre-center", "centre"],
  ["centimetre-centimeter", "centimetre, or centimeter"],
  ["driving-drivers-licence", "driving, or driver's licence"],
  ["examination-exam", "examination, or exam"],
  ["give-somebody-a-call-ring", "give somebody a call, or ring"],
  ["lots-a-lot", "lots, or a lot"],
  ["maths-mathematics", "maths, or mathematics"],
  ["ok-okay", "OK"],
  ["poor-thing-you", "poor thing, or poor you"],
  ["prefer-would-prefer", "prefer, or would prefer"],
  ["v-versus", "V, or versus"]
]);

const brightWords = new Set(["amazed", "amazing", "awesome"]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}\n${error}`)));
  });
}

await Promise.all([
  mkdir(outputDir, { recursive: true }),
  mkdir(rawDir, { recursive: true }),
  mkdir(readyDir, { recursive: true })
]);

try {
  const jobs = [];
  for (const entry of data.entries) {
    if (requestedSlugs.size && !requestedSlugs.has(entry.slug)) continue;
    if (!requestedSlugs.size) {
      try {
        await access(join(outputDir, `${entry.slug}.mp3`));
        continue;
      } catch {}
    }
    jobs.push(entry);
  }
  let completed = 0;
  const queue = [...jobs];

  async function createRecording(entry) {
    const source = join(rawDir, `${entry.slug}.mp3`);
    const target = join(readyDir, `${entry.slug}.mp3`);
    const spoken = spokenOverrides.get(entry.slug) || entry.headword
      .replace(/\(h\)/gi, "h")
      .replace(/\([^)]*\)/g, "")
      .split("/")[0]
      .trim();
    const text = `${spoken}${brightWords.has(entry.slug) ? "!" : "."}`;
    await run("uvx", [
      "--from", "edge-tts", "edge-tts",
      "--voice", VOICE,
      "--rate=-4%",
      "--volume=+0%",
      "--pitch=+2Hz",
      "--text", text,
      "--write-media", source
    ]);
    await run("ffmpeg", [
      "-y", "-loglevel", "error", "-i", source,
      "-af", "silenceremove=start_periods=1:start_duration=0.02:start_silence=0.10:start_threshold=-52dB,areverse,silenceremove=start_periods=1:start_duration=0.03:start_silence=0.18:start_threshold=-52dB,areverse,loudnorm=I=-12:TP=-1:LRA=5",
      "-ac", "1", "-ar", "44100", "-b:a", "96k", target
    ]);
    completed += 1;
    process.stdout.write(`\r${VOICE} audio ${completed}/${jobs.length}`);
  }

  async function worker() {
    while (queue.length) {
      const entry = queue.shift();
      await createRecording(entry);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await Promise.all(jobs.map((entry) =>
    copyFile(join(readyDir, `${entry.slug}.mp3`), join(outputDir, `${entry.slug}.mp3`))
  ));
  process.stdout.write("\n");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
