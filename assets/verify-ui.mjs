import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const [app, styles, main, worker, index, vite, packageText] = await Promise.all([
  readFile(join(ROOT, "src/App.jsx"), "utf8"),
  readFile(join(ROOT, "src/styles.css"), "utf8"),
  readFile(join(ROOT, "src/main.jsx"), "utf8"),
  readFile(join(ROOT, "public/sw.js"), "utf8"),
  readFile(join(ROOT, "index.html"), "utf8"),
  readFile(join(ROOT, "vite.config.js"), "utf8"),
  readFile(join(ROOT, "package.json"), "utf8")
]);

const checks = [
  ["correct product name", index.includes("Cambridge KET Flashcards") && app.includes("Cambridge KET")],
  ["complete course data", app.includes('import course from "./data/ket-course.json"')],
  ["one card face is conditionally mounted", app.includes("{!flipped ? (")],
  ["fragile 3D flip is absent", !styles.includes("rotateY(") && !styles.includes("backface-visibility")],
  ["safe tactile flip timing", app.includes("const FLIP_CLOSE_MS = 240") && app.includes("const FLIP_OPEN_MS = 340") && styles.includes("@keyframes card-fold-safe")],
  ["fixed zero-scroll shell", styles.includes("height: 100dvh") && /html,[\s\S]*?#root[\s\S]*?overflow:\s*hidden/.test(styles)],
  ["front shows a clue image", app.includes('className="clue-frame"') && app.includes("src={card.image}")],
  ["one icon-only British pronunciation control", app.includes("Play British pronunciation") && app.includes("card.ukAudio") && app.includes("<SpeakerIcon />") && !app.includes("<span>UK</span>") && !app.includes("speechSynthesis") && !app.includes("usAudio")],
  ["back is deliberately minimal", app.includes("card.chineseGlosses.join") && app.includes("card.definition") && app.includes("card.example") && !app.includes("collocations")],
  ["back label is Meaning only", app.includes('className="detail-label">Meaning</span>') && !/easy meaning/i.test(app)],
  ["meaning words have gentle breathing room", styles.includes("word-spacing: 0.08em")],
  ["wide headwords scale down", app.includes("function visualWordWidth(word)") && styles.includes(".headword.is-very-long")],
  ["previous and next controls remain", app.includes("Previous") && app.includes("Finish group") && app.includes("goNext")],
  ["progress persists per group", app.includes("localStorage.setItem") && app.includes("tb-cambridge-ket-course-progress-v2")],
  ["every letter has a pep talk", app.includes("const PEP_TALKS") && app.includes("Zipped all the way to zoo")],
  ["celebration is hard locked", app.includes("CELEBRATION_LOCK_MS") && app.includes("if (celebrating) return") && app.includes("disabled={!ready}")],
  ["celebration requires a fresh trusted pointer click", app.includes("event.isTrusted") && app.includes("celebrationPointerRef.current") && app.includes("onPointerDown={onArmContinue}") && !app.includes("setTimeout(continueAfterCelebration")],
  ["celebration has no alternate exit", !app.includes("Review {label}") && !app.includes("onReview={restartStudy}")],
  ["celebration blocks every background exit", app.includes("if (celebrating && !allowCelebrationExit) return") && (app.match(/disabled=\{celebrating\}/g) || []).length >= 5],
  ["appendix word sets are present", app.includes("course.appendixes.wordSets") && app.includes("Appendix 1")],
  ["all classified topic lists are present", app.includes("course.appendixes.topicLists") && app.includes("25 official topic classifications")],
  ["dark theme is persistent and intentional", app.includes("Use ${theme === \"dark\" ? \"light\" : \"dark\"} theme") && styles.includes(':root[data-theme="dark"]')],
  ["youth department appears before the phone number", /海归湾国际教育青少部<\/span>[\s\S]*?href="tel:4000616820"/.test(app)],
  ["mobile keeps the card within the viewport", /@media \(max-width: 760px\)[\s\S]*?grid-template-rows:\s*45px minmax\(0, 1fr\) 19px/.test(styles) && styles.includes("min-width: 320px")],
  ["mobile clue pictures stay level", /@media \(max-width: 760px\)[\s\S]*?\.clue-frame\s*\{[\s\S]*?transform:\s*none;/.test(styles)],
  ["short desktop keeps the celebration action visible", styles.includes("@media (max-height: 720px) and (min-width: 761px)") && styles.includes(".celebration-card { min-height: 0; padding: 18px; gap: 8px")],
  ["old service workers retire instead of refreshing", main.includes("getRegistrations") && main.includes("registration.unregister") && !main.includes(".register(") && worker.includes("self.registration.unregister") && !worker.includes("clients.claim")],
  ["preview hot reload is disabled", vite.includes("hmr: false")],
  ["shared preview serves a compiled build", packageText.includes('"dev": "vite build && vite preview"')]
];

const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error(failed.map(([label]) => `FAIL ${label}`).join("\n"));
  process.exit(1);
}

console.log(`PASS ${checks.length}/${checks.length} UI contracts · 25 locked celebrations · appendixes · light/dark · phone-safe shell`);
