import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const data = JSON.parse(await readFile(join(ROOT, "src/data/ket-course.json"), "utf8"));
const reviewedBz = JSON.parse(await readFile(join(ROOT, "src/data/ket-bz-reviewed.json"), "utf8"));
const errors = [];
const skipAssets = process.env.KET_SKIP_ASSETS === "1";

function words(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function cleanOfficial(value) {
  return value.replace(/\s+\((?:adj|adv|n|v|prep|ability|request|offer|possibility|permission)\)$/i, "").trim();
}

function normaliseTerm(value) {
  return value
    .toLowerCase()
    .replace(/\((?:adj|adv|n|v|prep|pron|det|conj|exclam|phr v|n & v)\)/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9@]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function aliasesFor(value) {
  const raw = value.toLowerCase();
  const values = new Set([normaliseTerm(raw)]);
  values.add(normaliseTerm(raw.replace(/\([^)]*\)/g, "")));
  values.add(normaliseTerm(raw.replace(/[()]/g, "")));
  raw.split("/").forEach((part) => values.add(normaliseTerm(part)));
  return [...values].filter(Boolean);
}

if (data.totalEntries !== 1726 || data.entries.length !== 1726) errors.push(`expected 1726 entries, found ${data.entries.length}`);
if (data.groups.length !== 25) errors.push(`expected 25 letter groups, found ${data.groups.length}`);
if (data.groups.some((group) => group.id === "X")) errors.push("the official list has no X group");
if (data.entries[0]?.headword !== "a/an") errors.push("first entry must be a/an");
if (data.entries.at(-1)?.headword !== "zoo") errors.push("last alphabetical entry must be zoo");
if (data.appendixes.wordSets.length !== 7) errors.push("Appendix 1 must contain seven word sets");
if (data.appendixes.topicLists.length !== 25) errors.push("Appendix 2 must contain 25 topic lists");
if (data.appendixes.topicLists.at(-1)?.title !== "Work and Jobs") errors.push("last topic must be Work and Jobs");
if (data.appendixes.topicLists.at(-1)?.terms.at(-1) !== "writer") errors.push("last classified topic word must be writer");
const aliasIndex = new Set(data.entries.flatMap((entry) => aliasesFor(entry.headword)));
for (const topic of data.appendixes.topicLists) {
  for (const term of topic.terms) {
    const linkedTerms = [term, ...(data.appendixes.topicAliases?.[term] || [])];
    if (!linkedTerms.some((linkedTerm) => aliasesFor(linkedTerm).some((alias) => aliasIndex.has(alias)))) {
      errors.push(`${topic.title}: classified term cannot open a flashcard: ${term}`);
    }
  }
}
const reviewedCards = reviewedBz.cards || [];
const reviewedIds = new Set(reviewedCards.map((card) => card.id));
const reviewedById = new Map(reviewedCards.map((card) => [card.id, card]));
if (reviewedCards.length !== 1628 || reviewedIds.size !== 1628 || [...Array(1628)].some((_, index) => !reviewedIds.has(index + 99))) {
  errors.push(`B–Z editorial review must contain every id from 99 through 1726 exactly once (found ${reviewedCards.length} rows / ${reviewedIds.size} unique ids)`);
}

const seenIds = new Set();
const seenSlugs = new Set();
let cambridgeCount = 0;
let authoredCount = 0;

for (const [index, entry] of data.entries.entries()) {
  const prefix = `#${index + 1} ${entry.headword || "(missing)"}`;
  if (entry.id !== index + 1) errors.push(`${prefix}: id is out of order`);
  if (!entry.slug || seenSlugs.has(entry.slug)) errors.push(`${prefix}: missing or duplicate slug`);
  if (seenIds.has(entry.id)) errors.push(`${prefix}: duplicate id`);
  seenIds.add(entry.id);
  seenSlugs.add(entry.slug);
  for (const field of ["letter", "headword", "partOfSpeech", "definition", "example", "imageAlt", "ukAudio", "image"]) {
    if (!entry[field]) errors.push(`${prefix}: missing ${field}`);
  }
  if (!Array.isArray(entry.chineseGlosses) || entry.chineseGlosses.length < 1 || entry.chineseGlosses.length > 2) {
    errors.push(`${prefix}: Chinese glosses must contain one or two items`);
  }
  if (words(entry.definition) < 3 || words(entry.definition) > 8) {
    errors.push(`${prefix}: definition must contain 3–8 words (${words(entry.definition)})`);
  }
  if (/\b(?:clause|conjunction|determiner|modal|noun|participle|preposition|pronoun|transitive|intransitive|present participle|past participle|past tense|plural form|singular form|past form|a person place or thing|used in everyday English|to do this action)\b|\b[xyz]\b/i.test(entry.definition)) {
    errors.push(`${prefix}: definition contains grammar jargon, variables, or a generic fallback`);
  }
  if (entry.chineseGlosses.some((gloss) => !/[\u3400-\u9fff]/.test(gloss) || gloss.length > 8)) {
    errors.push(`${prefix}: Chinese gloss must stay tiny and use Chinese characters`);
  }
  if (entry.letter !== "A") {
    const reviewed = reviewedById.get(entry.id);
    if (!reviewed) {
      errors.push(`${prefix}: missing child-language editorial review`);
    } else {
      if (entry.definition !== reviewed.definition) errors.push(`${prefix}: reviewed definition was not applied`);
      if (JSON.stringify(entry.chineseGlosses) !== JSON.stringify(reviewed.chineseGlosses)) errors.push(`${prefix}: reviewed Chinese glosses were not applied`);
      if (entry.example !== reviewed.example) errors.push(`${prefix}: reviewed example was not applied`);
    }
  }
  if (entry.exampleSource === "cambridge") {
    cambridgeCount += 1;
    const official = (entry.officialExamples || []).map(cleanOfficial);
    if (!official.includes(entry.example)) errors.push(`${prefix}: official example changed`);
  } else if (entry.exampleSource === "authored") {
    authoredCount += 1;
    if (words(entry.example) < 4 || words(entry.example) > 9) {
      errors.push(`${prefix}: authored example must contain 4–9 words (${words(entry.example)})`);
    }
    if (entry.letter !== "A" && /^(?:Here is|We use .+ in class|The ball is)\b/i.test(entry.example)) {
      errors.push(`${prefix}: authored example uses a weak template`);
    }
  } else {
    errors.push(`${prefix}: invalid exampleSource`);
  }
  if (entry.ukAudio !== `/audio/uk/${entry.slug}.mp3`) errors.push(`${prefix}: invalid UK audio path`);
  if (entry.image !== `/images/${entry.letter.toLowerCase()}/${entry.slug}.webp`) errors.push(`${prefix}: invalid clue image path`);
  if ("usAudio" in entry || "sentenceAudio" in entry || "collocations" in entry) errors.push(`${prefix}: forbidden extra study field`);
  if (entry.sourcePage < 4 || entry.sourcePage > 23) errors.push(`${prefix}: invalid official source page`);

  if (skipAssets) continue;
  for (const asset of [entry.ukAudio, entry.image]) {
    try {
      const info = await stat(join(ROOT, "public", asset));
      if (!info.isFile() || info.size < 100) errors.push(`${prefix}: empty asset ${asset}`);
      if (asset === entry.image && info.size < 3000) errors.push(`${prefix}: clue image is suspiciously compressed`);
    } catch {
      errors.push(`${prefix}: missing asset ${asset}`);
    }
  }
  try {
    const [geometry, entropyText] = execFileSync("identify", ["-format", "%wx%h %[entropy]", join(ROOT, "public", entry.image)], { encoding: "utf8" }).trim().split(/\s+/);
    if (geometry !== "640x400") errors.push(`${prefix}: clue image must be 640x400, found ${geometry}`);
    if (!Number.isFinite(Number(entropyText)) || Number(entropyText) < 0.45) errors.push(`${prefix}: clue image is too visually flat`);
  } catch {
    errors.push(`${prefix}: clue image dimensions could not be checked`);
  }
  try {
    const duration = Number(execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", join(ROOT, "public", entry.ukAudio)
    ], { encoding: "utf8" }).trim());
    if (!Number.isFinite(duration) || duration < 0.3 || duration > 4.5) errors.push(`${prefix}: suspicious UK audio duration ${duration}`);
  } catch {
    errors.push(`${prefix}: UK audio duration could not be checked`);
  }
}

for (const group of data.groups) {
  const cards = data.entries.filter((entry) => entry.letter === group.id);
  if (cards.length !== group.count) errors.push(`Group ${group.id}: count mismatch`);
  if (cards[0]?.id !== group.firstEntryId || cards.at(-1)?.id !== group.lastEntryId) errors.push(`Group ${group.id}: boundary mismatch`);
}

if (errors.length) {
  console.error(errors.slice(0, 160).join("\n"));
  console.error(`FAILED with ${errors.length} issue(s)`);
  process.exit(1);
}

console.log(`PASS ${data.entries.length}/${data.entries.length} cards · ${data.groups.length} letter groups · ${cambridgeCount} Cambridge examples · ${authoredCount} child examples · 7 word sets · 25 topic lists${skipAssets ? " · assets skipped" : " · all image/audio assets"}`);
