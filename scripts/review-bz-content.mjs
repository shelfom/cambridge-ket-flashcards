import { access, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const course = JSON.parse(await readFile(join(ROOT, "src/data/ket-course.json"), "utf8"));
const outputPath = join(ROOT, "src/data/ket-bz-reviewed.json");
const batchSize = Math.max(20, Math.min(120, Number(process.env.KET_REVIEW_BATCH_SIZE || 80)));
const concurrency = Math.max(1, Math.min(5, Number(process.env.KET_REVIEW_CONCURRENCY || 4)));
const reviewCli = process.env.KET_REVIEW_CLI || "codex";
const codexSchemaPath = join(ROOT, "scripts/ket-review-schema.json");
const requestedLimit = Number(process.argv.find((value) => value.startsWith("--limit="))?.split("=")[1] || 0);
const force = process.argv.includes("--force");
const officialOnly = process.argv.includes("--official-only");

const schema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          chineseGlosses: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: { type: "string" },
          },
          definition: { type: "string" },
          example: { type: "string" },
        },
        required: ["id", "chineseGlosses", "definition", "example"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
};

function wordCount(value) {
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}

function validateBatch(batch, cards) {
  const errors = [];
  const expected = new Map(batch.map((entry) => [entry.id, entry]));
  if (!Array.isArray(cards) || cards.length !== batch.length) {
    errors.push(`expected ${batch.length} cards, received ${cards?.length ?? "none"}`);
    return errors;
  }
  const seen = new Set();
  for (const card of cards) {
    const source = expected.get(card.id);
    if (!source) {
      errors.push(`unexpected id ${card.id}`);
      continue;
    }
    if (seen.has(card.id)) errors.push(`duplicate id ${card.id}`);
    seen.add(card.id);
    if (!Array.isArray(card.chineseGlosses) || card.chineseGlosses.length < 1 || card.chineseGlosses.length > 2) {
      errors.push(`${source.headword}: Chinese gloss count`);
    } else if (card.chineseGlosses.some((gloss) => !/[\u3400-\u9fff]/.test(gloss) || [...gloss].length > 6)) {
      errors.push(`${source.headword}: Chinese gloss is not tiny`);
    }
    if (wordCount(card.definition) < 3 || wordCount(card.definition) > 8) {
      errors.push(`${source.headword}: definition has ${wordCount(card.definition)} words`);
    }
    if (/\b(?:clause|conjunction|determiner|modal|participle|preposition|pronoun|transitive|intransitive|used in everyday English|the plural form|the past form)\b/i.test(card.definition)) {
      errors.push(`${source.headword}: definition contains grammar jargon`);
    }
    if (source.exampleSource !== "cambridge" && (wordCount(card.example) < 4 || wordCount(card.example) > 9)) {
      errors.push(`${source.headword}: example has ${wordCount(card.example)} words`);
    }
    if (/[\u3400-\u9fff]/.test(card.example)) errors.push(`${source.headword}: Chinese inside English example`);
    if (/^(?:Here is|We use .+ in class|The ball is)\b/i.test(card.example)) {
      errors.push(`${source.headword}: weak or unnatural example`);
    }
    if (source.exampleSource === "cambridge" && card.example !== source.example) {
      errors.push(`${source.headword}: official example changed`);
    }
  }
  for (const entry of batch) if (!seen.has(entry.id)) errors.push(`${entry.headword}: missing id`);
  return errors;
}

function promptFor(batch, retryNotes = "") {
  const payload = batch.map((entry) => ({
    id: entry.id,
    headword: entry.headword,
    partOfSpeech: entry.partOfSpeech,
    officialExamples: entry.officialExamples,
    fixedOfficialExample: entry.exampleSource === "cambridge" ? entry.example : null,
  }));
  return `You are the final child-language editor for Cambridge KET Flashcards used by Chinese elementary pupils aged 7–11.

Return exactly one card for every input id, in the same order.

For each card:
1. chineseGlosses: one or two ordinary Simplified Chinese meanings. Each gloss must be only 1–6 Chinese characters. Use words a young child already knows. No pinyin, labels, brackets, or dictionary jargon.
2. definition: 3–8 words of very easy, natural English. Explain the intended everyday A2 meaning. Use easier words than the headword. Never use grammar terms such as clause, conjunction, modal, pronoun, transitive, or participle. Never write a circular definition, a fragment, or “the plural form of...”.
3. example: one natural 4–9-word sentence a child can picture. It must clearly demonstrate the headword or a normal inflected/alternate form. Avoid obscure names, adult topics, cultural facts, difficult vocabulary, and empty patterns such as “Here is...”, “We use ... in class”, or “The ball is ...”.
4. If fixedOfficialExample is not null, copy it byte-for-byte as example. It is official Cambridge wording and must not change.
5. When fixedOfficialExample is present, the definition and Chinese glosses must explain the exact sense shown in that sentence.
6. Use officialExamples only to choose the right meaning. Do not copy an official fragment unless fixedOfficialExample supplies the complete sentence.

Good models:
- writer → 作家 | a person who writes books | She wants to be a writer.
- however → 然而 | another way to say but | It rained. However, we still played.
- per → 每 | for each person or thing | The apples cost two pounds per bag.
- tights → 连裤袜 | thin leg clothes worn under a skirt | Her black tights are very warm.

${retryNotes ? `Correct these earlier validation problems: ${retryNotes}\n` : ""}INPUT:
${JSON.stringify(payload)}`;
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const isCodex = reviewCli === "codex";
    const cliArgs = isCodex ? [
      "exec",
      "--ignore-user-config",
      "--ignore-rules",
      "--ephemeral",
      "--sandbox", "read-only",
      "--output-schema", codexSchemaPath,
      prompt,
    ] : [
      "--bare",
      "--print",
      "--tools", "",
      "--no-session-persistence",
      "--effort", "high",
      "--max-budget-usd", "0.50",
      "--output-format", "json",
      "--json-schema", JSON.stringify(schema),
      prompt,
    ];
    const child = spawn(reviewCli, cliArgs, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || stdout || `${reviewCli} exited ${code}`));
      if (isCodex) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (error) {
          reject(new Error(`Could not parse Codex structured output: ${error.message}\n${stdout.slice(-1200)}`));
        }
        return;
      }
      const lines = stdout.trim().split(/\r?\n/).filter((line) => line.trim().startsWith("{"));
      try {
        const wrapper = JSON.parse(lines.at(-1));
        resolve(wrapper.structured_output || JSON.parse(wrapper.result));
      } catch (error) {
        reject(new Error(`Could not parse structured output: ${error.message}\n${stdout.slice(-1200)}`));
      }
    });
  });
}

async function reviewBatch(batch) {
  let notes = "";
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await runClaude(promptFor(batch, notes));
      const errors = validateBatch(batch, result.cards);
      if (!errors.length) return result.cards;
      notes = errors.slice(0, 24).join("; ");
      lastError = new Error(notes);
    } catch (error) {
      lastError = error;
      notes = error.message.slice(0, 900);
    }
  }
  throw lastError;
}

let reviewed = [];
if (!force) {
  try {
    await access(outputPath);
    reviewed = JSON.parse(await readFile(outputPath, "utf8")).cards || [];
  } catch { /* first review pass */ }
}

const reviewedIds = new Set(reviewed.map((card) => card.id));
let candidates = officialOnly
  ? course.entries.filter((entry) => entry.letter !== "A" && entry.exampleSource === "cambridge")
  : course.entries.filter((entry) => entry.letter !== "A" && !reviewedIds.has(entry.id));
if (requestedLimit > 0) candidates = candidates.slice(0, requestedLimit);
const batches = [];
for (let index = 0; index < candidates.length; index += batchSize) batches.push(candidates.slice(index, index + batchSize));

let cursor = 0;
let completed = 0;
const failures = [];
let saveChain = Promise.resolve();

async function saveProgress(cards) {
  const incomingIds = new Set(cards.map((card) => card.id));
  reviewed = reviewed.filter((card) => !incomingIds.has(card.id));
  reviewed.push(...cards);
  reviewed.sort((a, b) => a.id - b.id);
  saveChain = saveChain.then(() => writeFile(outputPath, JSON.stringify({ cards: reviewed }, null, 2) + "\n"));
  await saveChain;
}

async function worker() {
  while (cursor < batches.length) {
    const index = cursor++;
    const batch = batches[index];
    try {
      const cards = await reviewBatch(batch);
      await saveProgress(cards);
      completed += cards.length;
      console.log(`Reviewed ${completed}/${candidates.length} · ${batch[0].headword} → ${batch.at(-1).headword}`);
    } catch (error) {
      failures.push(`${batch[0].id}-${batch.at(-1).id}: ${error.message}`);
      console.error(`FAILED ${batch[0].headword} → ${batch.at(-1).headword}: ${error.message.slice(0, 500)}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
await saveChain;

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Finished ${completed} new reviews; ${reviewed.length} B–Z cards are now child-edited.`);
