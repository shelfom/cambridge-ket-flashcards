import { useEffect, useMemo, useRef, useState } from "react";
import course from "./data/ket-course.json";

const STORAGE_KEY = "tb-cambridge-ket-course-progress-v2";
const FLIP_CLOSE_MS = 240;
const FLIP_OPEN_MS = 340;
const CELEBRATION_LOCK_MS = 520;
const ACCENTS = ["coral", "sun", "sky", "mint", "berry", "peach"];
const PEP_TALKS = {
  A: "A whole letter conquered. Your word lantern is glowing!",
  B: "Big group, brilliant work. Your brain just grew another branch!",
  C: "C was crowded, and you stayed curious. That is real learning power!",
  D: "Done with D! Give your clever head a tiny victory nod.",
  E: "Excellent work. Every new word makes the next one friendlier.",
  F: "Fantastic focus! You kept going and found every F word.",
  G: "Great job. Your growing word garden has another bright corner.",
  H: "High five for H! You listened, looked, and learned like a pro.",
  I: "Impressive! Small steps have carried you through another whole group.",
  J: "Joyful job! J was short, but your achievement is still huge.",
  K: "King-size effort on K. Keep that brave little spark alive!",
  L: "Lovely learning! You have made a long list feel light.",
  M: "Mighty work on M. Your memory muscles are getting stronger.",
  N: "Nice one! New words are starting to feel like old friends.",
  O: "Outstanding! One more group now belongs to you.",
  P: "Powerful patience! P was packed, and you finished every card.",
  Q: "Quick and clever! You have collected every rare little Q word.",
  R: "Remarkable work. Rest for a smile, then roll on when ready.",
  S: "Superstar! S was the giant group, and you reached the other side.",
  T: "Terrific! Your word treasure box is getting wonderfully full.",
  U: "Unstoppable! You understood another group one card at a time.",
  V: "Very well done. Your courage is louder than any tricky word.",
  W: "Wonderful work! You walked through W without rushing.",
  Y: "Yes! You are almost at the end, and your effort really shows.",
  Z: "Zipped all the way to zoo! The complete A–Z adventure is yours."
};

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10v4h4l5 4V6L8 10H4Z" />
      <path d="M16 9c1.2 1.7 1.2 4.3 0 6M18.8 6.5c2.7 3.1 2.7 7.9 0 11" />
    </svg>
  );
}

function ArrowIcon({ direction = "right" }) {
  return (
    <svg className={direction === "left" ? "is-left" : ""} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

function ThemeIcon({ theme }) {
  return theme === "dark" ? <span aria-hidden="true">☀</span> : <span aria-hidden="true">☾</span>;
}

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      study: value.study?.kind === "topic" ? value.study : { kind: "letter", id: value.study?.id || "A" },
      indexes: value.indexes && typeof value.indexes === "object" ? value.indexes : {},
      celebrating: Boolean(value.celebrating),
      theme: value.theme === "dark" ? "dark" : "light"
    };
  } catch {
    return { study: { kind: "letter", id: "A" }, indexes: {}, celebrating: false, theme: "light" };
  }
}

function studyKey(study) {
  return `${study.kind}:${study.id}`;
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

function buildAliasIndex(entries) {
  const index = new Map();
  entries.forEach((entry) => {
    aliasesFor(entry.headword).forEach((alias) => {
      if (!index.has(alias)) index.set(alias, []);
      index.get(alias).push(entry);
    });
  });
  return index;
}

function resolveTopicEntries(topic, aliasIndex) {
  const found = [];
  const seen = new Set();
  topic.terms.forEach((term) => {
    const linkedTerms = [term, ...(course.appendixes.topicAliases?.[term] || [])];
    const matches = linkedTerms.flatMap((linkedTerm) =>
      aliasesFor(linkedTerm).flatMap((alias) => aliasIndex.get(alias) || [])
    );
    matches.forEach((entry) => {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        found.push(entry);
      }
    });
  });
  return found;
}

function visualWordWidth(word) {
  const narrow = { i: 0.55, l: 0.58, t: 0.68, f: 0.7, j: 0.7, r: 0.76, ".": 0.35, " ": 0.45 };
  return [...word.toLowerCase()].reduce((total, letter) => {
    if (letter === "m" || letter === "w") return total + 1.3;
    return total + (narrow[letter] || 1);
  }, 0);
}

function exampleForms(card) {
  const special = {
    "a-an": ["a", "an"],
    "all-right-alright": ["all right", "alright"],
    "a-m": ["a.m."],
    "as-well-as": ["as well as", "as well"],
    "at-sign": ["@", "at"]
  };
  return special[card.slug] || [card.headword.replace(/[()]/g, "").replace(/\//g, "|")];
}

function exampleParts(card) {
  const forms = exampleForms(card)
    .flatMap((form) => form.split("|"))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!forms.length) return [card.example];
  const pattern = new RegExp(`(${forms.join("|")})`, "gi");
  return card.example.split(pattern);
}

export default function App() {
  const initial = useMemo(readState, []);
  const [study, setStudy] = useState(initial.study);
  const [indexes, setIndexes] = useState(initial.indexes);
  const [cardIndex, setCardIndex] = useState(() => Number(initial.indexes[studyKey(initial.study)]) || 0);
  const [celebrating, setCelebrating] = useState(initial.celebrating);
  const [celebrationReady, setCelebrationReady] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [flipPhase, setFlipPhase] = useState("idle");
  const [theme, setTheme] = useState(initial.theme);
  const audioRef = useRef(null);
  const flipTimerRef = useRef(null);
  const celebrationTimerRef = useRef(null);
  const celebrationPointerRef = useRef(false);

  const aliasIndex = useMemo(() => buildAliasIndex(course.entries), []);
  const activeTopic = useMemo(
    () => study.kind === "topic" ? course.appendixes.topicLists.find((topic) => topic.id === study.id) : null,
    [study]
  );
  const activeEntries = useMemo(() => {
    if (study.kind === "topic" && activeTopic) return resolveTopicEntries(activeTopic, aliasIndex);
    return course.entries.filter((entry) => entry.letter === study.id);
  }, [study, activeTopic, aliasIndex]);
  const activeKey = studyKey(study);
  const activeLabel = study.kind === "letter" ? `Group ${study.id}` : activeTopic?.title || "Topic list";
  const card = activeEntries[Math.min(cardIndex, Math.max(0, activeEntries.length - 1))] || course.entries[0];
  const progress = activeEntries.length ? ((cardIndex + 1) / activeEntries.length) * 100 : 0;
  const accent = ACCENTS[(study.kind === "letter" ? course.groups.findIndex((group) => group.id === study.id) : cardIndex) % ACCENTS.length];
  const width = visualWordWidth(card.headword);
  const headwordSize = width >= 15 ? "is-very-long" : width >= 11 ? "is-long" : width >= 8.8 ? "is-wide" : "";

  useEffect(() => {
    const storedIndex = Math.max(0, Math.min(activeEntries.length - 1, Number(indexes[activeKey]) || 0));
    setCardIndex(storedIndex);
  }, [activeKey, activeEntries.length]);

  useEffect(() => {
    const nextIndexes = { ...indexes, [activeKey]: cardIndex };
    if (indexes[activeKey] !== cardIndex) setIndexes(nextIndexes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ study, indexes: nextIndexes, celebrating, theme }));
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111713" : "#fff7df");
  }, [study, activeKey, cardIndex, celebrating, theme]);

  useEffect(() => {
    if (!celebrating) {
      setCelebrationReady(false);
      celebrationPointerRef.current = false;
      return;
    }
    setCelebrationReady(false);
    celebrationPointerRef.current = false;
    window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => setCelebrationReady(true), CELEBRATION_LOCK_MS);
  }, [celebrating]);

  useEffect(() => {
    if (celebrating || !activeEntries.length) return;
    const next = activeEntries[Math.min(cardIndex + 1, activeEntries.length - 1)];
    const image = new Image();
    image.src = next.image;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = next.ukAudio;
  }, [cardIndex, activeEntries, celebrating]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (groupsOpen || sourcesOpen) {
        if (event.key === "Escape") {
          setGroupsOpen(false);
          setSourcesOpen(false);
        }
        return;
      }
      if (celebrating) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if ((event.key === " " || event.key === "Enter") && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        requestFlip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => () => {
    window.clearTimeout(flipTimerRef.current);
    window.clearTimeout(celebrationTimerRef.current);
    audioRef.current?.pause();
  }, []);

  function resetCardFace(nextFlipped = false) {
    window.clearTimeout(flipTimerRef.current);
    setFlipPhase("idle");
    setFlipped(nextFlipped);
    setSpeaking(false);
    setAudioError(false);
    audioRef.current?.pause();
  }

  function requestFlip() {
    if (flipPhase !== "idle" || celebrating) return;
    setFlipPhase("closing");
    window.clearTimeout(flipTimerRef.current);
    flipTimerRef.current = window.setTimeout(() => {
      setFlipped((value) => !value);
      setFlipPhase("opening");
      flipTimerRef.current = window.setTimeout(() => setFlipPhase("idle"), FLIP_OPEN_MS);
    }, FLIP_CLOSE_MS);
  }

  function goPrevious() {
    if (cardIndex === 0 || celebrating) return;
    setCardIndex((value) => value - 1);
    resetCardFace(false);
  }

  function goNext() {
    if (celebrating) return;
    if (cardIndex < activeEntries.length - 1) {
      setCardIndex((value) => value + 1);
      resetCardFace(false);
      return;
    }
    setCelebrating(true);
    resetCardFace(false);
  }

  function chooseStudy(nextStudy, allowCelebrationExit = false) {
    if (celebrating && !allowCelebrationExit) return;
    const nextKey = studyKey(nextStudy);
    setStudy(nextStudy);
    setCardIndex(Number(indexes[nextKey]) || 0);
    setCelebrating(false);
    setGroupsOpen(false);
    resetCardFace(false);
  }

  function armCelebrationContinue(event) {
    celebrationPointerRef.current = Boolean(
      celebrationReady && event.isTrusted && event.button === 0
    );
  }

  function disarmCelebrationContinue() {
    celebrationPointerRef.current = false;
  }

  function continueAfterCelebration(event) {
    const isFreshPointerClick = Boolean(
      celebrationReady && event?.isTrusted && celebrationPointerRef.current
    );
    celebrationPointerRef.current = false;
    if (!isFreshPointerClick) return;
    if (study.kind === "topic") {
      setCelebrating(false);
      setGroupsOpen(true);
      return;
    }
    const currentGroup = course.groups.findIndex((group) => group.id === study.id);
    const nextGroup = course.groups[currentGroup + 1];
    if (nextGroup) {
      chooseStudy({ kind: "letter", id: nextGroup.id }, true);
    } else {
      setCelebrating(false);
      setGroupsOpen(true);
    }
  }

  function playPronunciation(event) {
    event.stopPropagation();
    audioRef.current?.pause();
    setAudioError(false);
    const audio = new Audio(card.ukAudio);
    audioRef.current = audio;
    setSpeaking(true);
    const finish = () => setSpeaking(false);
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", () => {
      finish();
      setAudioError(true);
    }, { once: true });
    audio.play().catch(() => {
      finish();
      setAudioError(true);
    });
  }

  const nextLetter = study.kind === "letter"
    ? course.groups[course.groups.findIndex((group) => group.id === study.id) + 1]?.id
    : null;

  return (
    <div className={`app-shell accent-${accent}`} data-theme={theme}>
      <header className="topbar">
        <button className="brand" onClick={() => chooseStudy({ kind: "letter", id: "A" })} aria-label="Return to Group A" disabled={celebrating}>
          <span className="brand-title">Cambridge KET</span>
          <span className="brand-subtitle">flashcards</span>
        </button>
        <div className="top-actions">
          <button className="theme-button" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`} disabled={celebrating}>
            <ThemeIcon theme={theme} />
          </button>
          <button className="quiet-button source-button" onClick={() => setSourcesOpen(true)} disabled={celebrating}>Sources</button>
          <button className="quiet-button browse-button" onClick={() => setGroupsOpen(true)} disabled={celebrating}>
            Browse groups <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      <main className={`practice ${celebrating ? "is-celebrating" : ""}`}>
        <div className="practice-meta">
          <div className="position"><span>{activeLabel}</span><span aria-hidden="true">/</span><span>card {cardIndex + 1} of {activeEntries.length}</span></div>
          <div className="total-progress">{cardIndex + 1} / {activeEntries.length}</div>
        </div>
        <div className="progress-track" aria-label={`${cardIndex + 1} of ${activeEntries.length} cards in ${activeLabel}`}>
          <span style={{ width: `${progress}%` }} />
        </div>

        <section className={`stage ${celebrating ? "is-celebrating" : ""}`}>
          {celebrating ? (
            <Celebration
              study={study}
              label={activeLabel}
              count={activeEntries.length}
              nextLetter={nextLetter}
              ready={celebrationReady}
              onArmContinue={armCelebrationContinue}
              onDisarmContinue={disarmCelebrationContinue}
              onContinue={continueAfterCelebration}
            />
          ) : (
            <div
              className={`flashcard ${flipped ? "is-flipped" : ""} is-flip-${flipPhase}`}
              onClick={requestFlip}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  requestFlip();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={flipped ? `Showing details for ${card.headword}. Tap to show the picture clue.` : `${card.headword}. Tap to show its meaning.`}
              aria-pressed={flipped}
              aria-busy={flipPhase !== "idle"}
            >
              <span className="card-rotor">
                {!flipped ? (
                  <span className="card-face card-front" key={`front-${card.slug}`}>
                    <span className="front-kicker">KET word · {activeLabel}</span>
                    <span className="front-center">
                      <span className="clue-frame"><img src={card.image} alt={card.imageAlt} /></span>
                      <span className={`headword ${headwordSize}`}>{card.headword}</span>
                      <button
                        type="button"
                        className={`audio-button ${speaking ? "is-speaking" : ""} ${audioError ? "has-error" : ""}`}
                        onClick={playPronunciation}
                        aria-label={`Play British pronunciation of ${card.headword}`}
                      >
                        <span>UK</span><SpeakerIcon />
                      </button>
                    </span>
                    <span className="flip-hint">tap the card to reveal</span>
                  </span>
                ) : (
                  <span className="card-face card-back" key={`back-${card.slug}`}>
                    <span className="back-topline">
                      <span className="back-word">{card.headword}</span>
                      <span className="part-of-speech">{card.partOfSpeech}</span>
                    </span>
                    <span className="chinese">{card.chineseGlosses.join(" · ")}</span>
                    <span className="detail-block meaning-block">
                      <span className="detail-label">Meaning</span>
                      <span className="definition">{card.definition}</span>
                    </span>
                    <span className="detail-block example-block">
                      <span className="detail-label">example</span>
                      <span className="example">
                        {exampleParts(card).map((part, index) =>
                          index % 2 === 1 ? <strong key={`${part}-${index}`}>{part}</strong> : <span key={`${part}-${index}`}>{part}</span>
                        )}
                      </span>
                    </span>
                    <span className="flip-hint">tap to see the picture clue</span>
                  </span>
                )}
              </span>
            </div>
          )}
        </section>

        {!celebrating && (
          <nav className="card-nav" aria-label="Flashcard navigation">
            <button className="nav-button" onClick={goPrevious} disabled={cardIndex === 0}>
              <ArrowIcon direction="left" /><span>Previous</span>
            </button>
            <button className="nav-button next-button" onClick={goNext}>
              <span>{cardIndex === activeEntries.length - 1 ? "Finish group" : "Next"}</span><ArrowIcon />
            </button>
          </nav>
        )}
      </main>

      <footer className="footer">
        <span className="footer-brand">海归湾国际教育</span>
        <a className="footer-phone" href="tel:4000616820" aria-label="Call 海归湾国际教育 at 400-061-6820">400-061-6820</a>
        <button onClick={() => setSourcesOpen(true)} disabled={celebrating}>Unofficial Cambridge list practice</button>
      </footer>

      {groupsOpen && <GroupDialog current={study} onChoose={chooseStudy} onClose={() => setGroupsOpen(false)} />}
      {sourcesOpen && <SourcesDialog onClose={() => setSourcesOpen(false)} />}
    </div>
  );
}

function Celebration({ study, label, count, nextLetter, ready, onArmContinue, onDisarmContinue, onContinue }) {
  const isLetter = study.kind === "letter";
  const pepTalk = isLetter ? PEP_TALKS[study.id] : "You found a whole family of words that belong together. That is smart sorting!";
  const buttonText = isLetter ? (nextLetter ? `Learn Group ${nextLetter}` : "Explore the Appendixes") : "Choose another topic";
  return (
    <div className="celebration-card" role="status" aria-live="polite" tabIndex={-1}>
      <span className="celebration-art" aria-hidden="true">{isLetter ? study.id : "★"}</span>
      <span className="celebration-kicker">{label} complete</span>
      <h1>Congratulations!</h1>
      <p>{pepTalk}</p>
      <div className="celebration-stat"><strong>{count}</strong><span>{isLetter ? "words learned" : "topic words reviewed"}</span></div>
      <div className="celebration-actions">
        <button
          className="primary-button"
          onPointerDown={onArmContinue}
          onPointerCancel={onDisarmContinue}
          onClick={onContinue}
          disabled={!ready}
        >
          {buttonText} <ArrowIcon />
        </button>
      </div>
    </div>
  );
}

function GroupDialog({ current, onChoose, onClose }) {
  const [tab, setTab] = useState(current.kind === "topic" ? "topics" : "letters");
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="groups-title" onMouseDown={onClose}>
      <div className="modal groups-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="modal-kicker">complete course</span><h2 id="groups-title">Browse groups</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-tabs" role="tablist" aria-label="Course sections">
          <button className={tab === "letters" ? "is-active" : ""} onClick={() => setTab("letters")}>A–Z</button>
          <button className={tab === "sets" ? "is-active" : ""} onClick={() => setTab("sets")}>Word sets</button>
          <button className={tab === "topics" ? "is-active" : ""} onClick={() => setTab("topics")}>Topic lists</button>
        </div>

        {tab === "letters" && (
          <div className="letter-grid">
            {course.groups.map((group) => (
              <button key={group.id} className={`letter-tile ${current.kind === "letter" && current.id === group.id ? "is-current" : ""}`} onClick={() => onChoose({ kind: "letter", id: group.id })}>
                <strong>{group.id}</strong><span>{group.count} words</span>
              </button>
            ))}
          </div>
        )}

        {tab === "sets" && (
          <div className="appendix-list">
            <div className="appendix-intro"><strong>Appendix 1</strong><span>Official word families and ranges</span></div>
            {course.appendixes.wordSets.map((set) => (
              <article className="appendix-card" key={set.id}>
                <h3>{set.title}</h3><p>{set.officialScope}</p>
              </article>
            ))}
          </div>
        )}

        {tab === "topics" && (
          <div className="topic-list">
            <div className="appendix-intro"><strong>Appendix 2</strong><span>25 official topic classifications</span></div>
            {course.appendixes.topicLists.map((topic) => (
              <button key={topic.id} className={`topic-card ${current.kind === "topic" && current.id === topic.id ? "is-current" : ""}`} onClick={() => onChoose({ kind: "topic", id: topic.id })}>
                <span><strong>{topic.title}</strong><small>{topic.terms.length} official entries</small></span>
                <span className="topic-preview">{topic.terms.slice(0, 4).join(" · ")}</span>
                <span className="topic-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SourcesDialog({ onClose }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="sources-title" onMouseDown={onClose}>
      <div className="modal sources-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="modal-kicker">source notes</span><h2 id="sources-title">About this course</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="source-copy">
          <p>All {course.totalEntries.toLocaleString()} alphabetical entries follow the <em>A2 Key and A2 Key for Schools Vocabulary List</em>, August 2025, pages 4–23, from <strong>a/an</strong> through <strong>zoo</strong>.</p>
          <p>Appendix 1 word sets and all 25 Appendix 2 topic lists follow pages 24–32. The final classified entry is <strong>writer</strong> in Work and Jobs.</p>
          <p>Complete Cambridge example sentences are kept unchanged. Where Cambridge supplies only a phrase or no example, this learning aid supplies one short child-level sentence.</p>
          <p>Chinese glosses, child-level wording, pep talks and natural British-female recordings were prepared for this unofficial learning aid. Cambridge does not endorse this product.</p>
          <p>Some plain-English wording was adapted and simplified from Simple English Wiktionary data distributed by Kaikki.org. Supporting clue artwork uses adapted OpenMoji elements under its CC BY-SA 4.0 licence.</p>
          <a href="https://kaikki.org/simplewiktionary/English/index.html" target="_blank" rel="noreferrer">Simple English Wiktionary data ↗</a>
          <a href="https://openmoji.org/" target="_blank" rel="noreferrer">OpenMoji ↗</a>
          <a href="https://www.cambridgeenglish.org/" target="_blank" rel="noreferrer">Cambridge English ↗</a>
        </div>
      </div>
    </div>
  );
}
