#!/usr/bin/env python3
"""Extract the August 2025 Cambridge A2 Key list and appendixes.

The PDF is a two-column alphabetical list followed by one word-set page and
eight four-column topic-list pages. This script keeps Cambridge ordering,
parts of speech, example bullets, source pages, and appendix classifications.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import pdfplumber


POS_TOKEN = re.compile(
    r"\((?:adj|adv|n|v|av|mv|prep|prep phr|phr v|pron|det|conj|exclam|pl|sing)"
    r"(?:[^)]*)\)",
    re.IGNORECASE,
)
LETTER = re.compile(r"^[A-Z]$")
PAGE_FOOTER = re.compile(r"^(?:©|Page \d+|A2 Key|Schools$|Vocabulary List$)")


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = value.lower().replace("@", " at-sign ").replace("&", " and ")
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "entry"


def split_headword(line: str) -> tuple[str, str] | None:
    match = POS_TOKEN.search(line)
    if not match:
        return None
    headword = line[: match.start()].strip()
    if not headword:
        return None
    remainder = line[match.start() :].strip()
    return headword, remainder


def clean_example(value: str) -> str:
    value = value.replace("•", "", 1).strip()
    value = re.sub(r"\s+", " ", value)
    # pdfplumber can split a word at the inner edge of the PDF's two columns.
    # These are layout artefacts; the visible Cambridge sentences are intact.
    value = value.replace("I’ve j oined a diving club.", "I’ve joined a diving club.")
    value = value.replace("T hey’re recording a new album.", "They’re recording a new album.")
    return value


def extract_alphabetical(pdf: pdfplumber.PDF) -> list[dict]:
    entries: list[dict] = []
    current: dict | None = None
    current_letter = ""
    pending_example = False
    used_slugs: defaultdict[str, int] = defaultdict(int)

    for page_number in range(4, 24):
        page = pdf.pages[page_number - 1]
        columns = [(35, 45, 298, 775), (298, 45, 560, 775)]
        for column in columns:
            text = page.crop(column).extract_text(x_tolerance=2, y_tolerance=3) or ""
            for raw_line in text.splitlines():
                line = re.sub(r"\s+", " ", raw_line).strip()
                if not line or PAGE_FOOTER.match(line):
                    continue
                if LETTER.fullmatch(line):
                    current_letter = line
                    current = None
                    pending_example = False
                    continue
                parsed = split_headword(line) if not line.startswith("•") else None
                if parsed:
                    headword, part_of_speech = parsed
                    base_slug = slugify(headword)
                    used_slugs[base_slug] += 1
                    slug = base_slug if used_slugs[base_slug] == 1 else f"{base_slug}-{used_slugs[base_slug]}"
                    current = {
                        "id": len(entries) + 1,
                        "letter": current_letter,
                        "slug": slug,
                        "headword": headword,
                        "partOfSpeechOfficial": part_of_speech,
                        "officialExamples": [],
                        "sourcePage": page_number,
                    }
                    entries.append(current)
                    pending_example = False
                    continue
                if line.startswith("•") and current:
                    current["officialExamples"].append(clean_example(line))
                    pending_example = True
                    continue
                if pending_example and current and current["officialExamples"]:
                    current["officialExamples"][-1] = clean_example(
                        f"{current['officialExamples'][-1]} {line}"
                    )

    return entries


def extract_word_sets(pdf: pdfplumber.PDF) -> list[dict]:
    page = pdf.pages[23]
    lines = page.extract_text_lines(strip=True, return_chars=True)
    groups: list[dict] = []
    current: dict | None = None
    for line in lines:
        top = float(line["top"])
        if top < 130 or top > 430:
            continue
        text = re.sub(r"\s+", " ", line["text"]).strip()
        fonts = {char["fontname"] for char in line["chars"]}
        is_heading = fonts and all("Bold" in font for font in fonts)
        if is_heading:
            current = {"id": slugify(text), "title": text, "officialScope": ""}
            groups.append(current)
        elif current:
            current["officialScope"] = re.sub(
                r"\s+", " ", f"{current['officialScope']} {text}"
            ).strip()
    return groups


def line_groups(words: list[dict], tolerance: float = 1.3) -> list[list[dict]]:
    rows: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not rows or abs(rows[-1][0]["top"] - word["top"]) > tolerance:
            rows.append([word])
        else:
            rows[-1].append(word)
    return rows


def extract_topic_lists(pdf: pdfplumber.PDF) -> list[dict]:
    topics: list[dict] = []
    current: dict | None = None

    for page_number in range(25, 33):
        page = pdf.pages[page_number - 1]
        words = page.extract_words(extra_attrs=["fontname", "size"])
        words = [word for word in words if 38 <= word["top"] <= 735]
        column_regions = [(45, 57), (160, 191), (300, 321), (425, 451)]
        for row in line_groups(words):
            row = sorted(row, key=lambda item: item["x0"])
            text = " ".join(word["text"] for word in row).strip()
            is_heading = (
                row[0]["x0"] < 75
                and all("Bold" in word["fontname"] for word in row)
                and text not in {"Appendix 2", "Topic Lists"}
            )
            if is_heading:
                current = {
                    "id": slugify(text),
                    "title": text,
                    "terms": [],
                    "_termRecords": [],
                    "sourcePages": [page_number],
                }
                topics.append(current)
                continue
            if not current:
                continue
            if page_number not in current["sourcePages"]:
                current["sourcePages"].append(page_number)
            cells: list[tuple[int, str]] = []
            cell_words: list[str] = []
            column_index = 0
            for word in row:
                matching_column = next(
                    (
                        index
                        for index, (left, right) in enumerate(column_regions)
                        if left <= word["x0"] <= right
                    ),
                    None,
                )
                starts_column = matching_column is not None
                if starts_column and cell_words:
                    cells.append((column_index, " ".join(cell_words).strip()))
                    cell_words = []
                if starts_column:
                    column_index = int(matching_column)
                cell_words.append(word["text"])
            if cell_words:
                cells.append((column_index, " ".join(cell_words).strip()))
            current["_termRecords"].extend(
                {
                    "sourcePage": page_number,
                    "column": column,
                    "top": float(row[0]["top"]),
                    "term": cell,
                }
                for column, cell in cells
            )

    for topic in topics:
        ordered = sorted(
            topic.pop("_termRecords"),
            key=lambda record: (
                record["sourcePage"],
                record["column"],
                record["top"],
            ),
        )
        terms: list[str] = []
        pending = ""
        pending_column: tuple[int, int] | None = None
        for record in ordered:
            record_column = (record["sourcePage"], record["column"])
            if pending and pending_column == record_column:
                term = f"{pending} {record['term']}".strip()
                pending = ""
                pending_column = None
            else:
                if pending:
                    terms.append(pending)
                term = record["term"]
            if term.endswith("/"):
                pending = term
                pending_column = record_column
            else:
                terms.append(term)
        if pending:
            terms.append(pending)
        topic["terms"] = terms
    return topics


def validate(data: dict) -> None:
    entries = data["entries"]
    assert entries[0]["headword"] == "a/an", entries[0]
    assert entries[-1]["headword"] == "zoo", entries[-1]
    assert entries[0]["letter"] == "A" and entries[-1]["letter"] == "Z"
    assert len({entry["id"] for entry in entries}) == len(entries)
    assert len({entry["slug"] for entry in entries}) == len(entries)
    assert data["topicLists"][-1]["title"] == "Work and Jobs"
    assert "writer" in data["topicLists"][-1]["terms"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    with pdfplumber.open(args.pdf) as pdf:
        data = {
            "title": "A2 Key and A2 Key for Schools Vocabulary List",
            "edition": "August 2025",
            "entries": extract_alphabetical(pdf),
            "wordSets": extract_word_sets(pdf),
            "topicLists": extract_topic_lists(pdf),
        }
    validate(data)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(
        f"Extracted {len(data['entries'])} alphabetical entries, "
        f"{len(data['wordSets'])} word sets, and {len(data['topicLists'])} topic lists."
    )


if __name__ == "__main__":
    main()
