import { access, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const data = JSON.parse(await readFile(join(ROOT, "src/data/ket-course.json"), "utf8"));
const outputRoot = join(ROOT, "public/images");
const rawRoot = join("/tmp", `ket-storybook-clues-${process.pid}`);
const concurrency = Math.max(1, Math.min(4, Number(process.env.KET_IMAGE_CONCURRENCY || 3)));
const batchSize = Math.max(1, Math.min(10, Number(process.env.KET_IMAGE_BATCH_SIZE || 8)));
const requestedSlugs = new Set(process.argv.slice(2));
const candidates = data.entries
  .map((entry, index) => ({ entry, index }))
  .filter(({ entry }) => requestedSlugs.size === 0 || requestedSlugs.has(entry.slug));
const jobs = [];
for (const job of candidates) {
  const target = join(outputRoot, job.entry.letter.toLowerCase(), `${job.entry.slug}.webp`);
  if (!requestedSlugs.size) {
    try {
      await access(target);
      continue;
    } catch {}
  }
  jobs.push(job);
}

if (requestedSlugs.size > 0 && jobs.length !== requestedSlugs.size) {
  const found = new Set(jobs.map(({ entry }) => entry.slug));
  const unknown = [...requestedSlugs].filter((slug) => !found.has(slug));
  throw new Error(`Unknown clue slug(s): ${unknown.join(", ")}`);
}

const styleReferenceUrl = process.env.KET_STYLE_REFERENCE_URL;
const landscapeGuideUrl = process.env.KET_STYLE_GUIDE_URL;
const visualOverrides = {
  "ago": "one rounded character turning an old calendar page backward; the calendar has faded blank squares and absolutely no writing",
  "airport": "one rounded traveller with a small rust-red bag looking through a wide terminal window at an aeroplane outside; no signs",
  "also": "one rounded character placing a blue crayon beside an existing red crayon to add one more choice",
  "always": "the same rounded schoolgirl smiling in the same place under three successive positions of soft window light, with no panels or captions",
  "apartment": "one warm glowing home seen through a single window inside a tall dark apartment building, with no labels",
  "april": "one rounded character walking through gentle spring rain among tulips and fresh new leaves",
  "article": "one rounded child reading a newspaper that contains only abstract horizontal lines and one simple dog picture, with no legible writing",
  "assistant": "one rounded shop helper handing a small parcel to a customer across a plain counter, with no shop sign or labels",
  "at": "two rounded children meeting beside one simple school gate, with no signs or writing",
  "attractive": "one rounded child admiring a beautifully painted muted teal-and-rust room wall, with no writing",
  "august": "one rounded character enjoying a warm late-summer day beside tall sunflowers and a quiet lake",
  "autumn": "rust-red and muted gold leaves falling around one rounded character in a quiet old courtyard"
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited ${code}\n${stderr || stdout}`));
    });
  });
}

function promptForBatch(batch) {
  const scenes = batch.map(({ entry }, index) => `${index + 1}. Headword idea: ${entry.headword}. Easy meaning: ${entry.definition}. Child example: ${entry.example}. Visual direction: ${visualOverrides[entry.slug] || entry.imageAlt}.`).join("\n");
  return `Create exactly ${batch.length} separate new 16:10 landscape vocabulary flashcard clue illustrations for children aged 6–11, one output image for each numbered scene below and in exactly this order. Every output must be a standalone continuous scene, never a panel, contact sheet, collage or page. The scene must instantly communicate its intended vocabulary idea when reduced to 640×400. Use only the few characters and objects needed for that meaning. Never render the vocabulary word itself.

SCENES — output one image per line, in order:
${scenes}

The supplied images are binding references for style, colour, texture, lighting and mood only. Do not copy their bear, audience creatures, classroom, hallway, poses, composition or objects.
Style: muted dark-whimsical European picture-book illustration; softly modelled rounded or pear-shaped characters where useful; tiny expressive eyes; delicate pencil and charcoal linework; matte painterly surfaces; aged-paper grain; restrained surreal humour; slightly imperfect handmade finish.
Composition: one continuous simple medium-wide 16:10 landscape scene; one immediately readable focal meaning; generous safe margins; all important subjects fully visible; no visual clutter.
Lighting and mood: dim soft theatrical window light, tender and curious rather than frightening.
Colour palette: dusty olive green, soot charcoal, warm cream, tobacco brown and restrained faded rust accents; low saturation, soft vignette and deep soft shadows.
Constraints: no headword, no captions, no readable text, no letters, no numbers, no logos, no watermark, no border; no split panels; no photorealism; no bright rainbow palette; no glossy digital look; do not reproduce any specific figure or composition from the references.`;
}

async function generateBatch(batch, batchIndex) {
  const rawDir = join(rawRoot, `batch-${batchIndex + 1}`);
  await mkdir(rawDir, { recursive: true });
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const args = [
        "generate", "image", promptForBatch(batch),
        "--size", "2560x1600",
        "--no-watermark",
        "--output-path", rawDir,
        "--format", "json"
      ];
      if (batch.length > 1) args.push("--sequential", "auto", "--max-images", String(batch.length));
      if (styleReferenceUrl) args.push("--image", styleReferenceUrl);
      if (landscapeGuideUrl) args.push("--image", landscapeGuideUrl);
      const stdout = await run("coze", args);
      const response = JSON.parse(stdout);
      const sources = response.saved_paths || [];
      if (sources.length !== batch.length) throw new Error(`Expected ${batch.length} images, received ${sources.length}`);
      for (let index = 0; index < batch.length; index += 1) {
        const entry = batch[index].entry;
        const letterDir = join(outputRoot, entry.letter.toLowerCase());
        await mkdir(letterDir, { recursive: true });
        const target = join(letterDir, `${entry.slug}.webp`);
        await run("magick", [sources[index], "-auto-orient", "-resize", "640x400!", "-strip", "-quality", "74", target]);
      }
      await rm(rawDir, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
    }
  }
  throw lastError;
}

await mkdir(outputRoot, { recursive: true });
await mkdir(rawRoot, { recursive: true });
const batches = [];
for (let index = 0; index < jobs.length; index += batchSize) batches.push(jobs.slice(index, index + batchSize));

let cursor = 0;
let completed = 0;
const failures = [];

async function worker() {
  while (cursor < batches.length) {
    const batchIndex = cursor;
    cursor += 1;
    const batch = batches[batchIndex];
    try {
      await generateBatch(batch, batchIndex);
      completed += batch.length;
      console.log(`Created ${completed}/${jobs.length} · ${batch[0].entry.headword} → ${batch.at(-1).entry.headword}`);
    } catch (error) {
      failures.push(`${batch.map(({ entry }) => entry.slug).join(",")}: ${error.message}`);
      console.error(`FAILED batch ${batchIndex + 1}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

try {
  if ((await readdir(rawRoot)).length === 0) await rm(rawRoot, { recursive: true, force: true });
} catch {}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Created all ${completed} requested polished storybook clue illustrations.`);
