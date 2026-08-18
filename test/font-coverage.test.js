import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { splitSkill, nonAscii } from "../scripts/measure-font-coverage.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

const skill = read("skills", "math-unicode", "SKILL.md");
const extendedDoc = read("skills", "math-unicode", "references", "extended-glyphs.md");
const fixture = JSON.parse(read("test", "fixtures", "font-coverage.json"));

const N = fixture.fontCount;
const key = (g) => `U+${g.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
const coverage = (g) => fixture.coverage[key(g)];

// Rows look like: | ᵨ | U+1D68 | 2/12 | `I_ρ` |
const COUNT_ROW = /^\| (.) \| (U\+[0-9A-F]{4,5}) \| (\d+)\/(\d+) \|/gmu;
// Rows look like: | number sets | ℕ ℤ ℚ ℝ ℂ ℙ ℍ | 3/12 |
const TIER_ROW = /^\| ([a-z][^|]*?) \| ([^|]+?) \| (\d+)(?:-(\d+))?\/(\d+) \|$/gm;

test("the measured font set is the one the skill claims", () => {
  assert.equal(N, 12);
  assert.equal(fixture.fonts.length, N);
  const families = fixture.fonts.map((f) => f.family);
  for (const expected of [
    "JetBrains Mono", "Fira Code", "Cascadia Code", "Hack", "Source Code Pro", "IBM Plex Mono",
    "DejaVu Sans Mono", "Liberation Mono", "Ubuntu Mono", "Ubuntu Sans Mono", "Noto Mono", "Cousine",
  ]) {
    assert.ok(families.includes(expected), `fixture is missing ${expected}`);
    assert.match(skill, new RegExp(expected.replace(/ /g, "\\s+")), `Font coverage section omits ${expected}`);
  }
});

test("every glyph the skill recommends renders in at least one measured font", () => {
  // The defect this catches: the cheatsheet advertised ∮ ⅆ ⅇ ℵ ∖ ⨁ 〈 and more,
  // which no monospace font in the set carries. A glyph below this bar belongs
  // in "Glyphs to avoid", in references/extended-glyphs.md, or named by code
  // point without being printed.
  const { recommended } = splitSkill(skill);
  const unrenderable = recommended.filter((g) => coverage(g) === 0);
  assert.deepEqual(
    unrenderable,
    [],
    `no measured font renders: ${unrenderable.map((g) => `${g} (${key(g)})`).join(", ")}`,
  );
  for (const g of recommended) {
    assert.notEqual(coverage(g), undefined, `${g} (${key(g)}) is not in the fixture; regenerate it`);
  }
});

test("the avoid list is earned, not asserted", () => {
  // Every entry must actually measure at or below one font. Without this the
  // list could quietly grow into a dumping ground for glyphs someone dislikes.
  const rows = [...skill.matchAll(COUNT_ROW)];
  assert.ok(rows.length >= 26, `expected the avoid table, found ${rows.length} rows`);
  for (const [, glyph, cp, have, total] of rows) {
    assert.equal(key(glyph), cp, `avoid row prints ${glyph} but labels it ${cp}`);
    assert.equal(Number(total), N);
    assert.equal(Number(have), coverage(glyph), `printed count for ${glyph} does not match the fixture`);
    assert.ok(coverage(glyph) <= 1, `${glyph} renders in ${coverage(glyph)} fonts; it does not belong on the avoid list`);
  }
});

test("the coverage tier table is derived from the fixture, not typed", () => {
  const section = skill.split("## Font coverage")[1].split("### Common LaTeX")[0];
  const rows = [...section.matchAll(TIER_ROW)];
  assert.ok(rows.length >= 10, `expected the tier table, found ${rows.length} rows`);
  for (const [, label, glyphs, lo, hi, total] of rows) {
    const chars = nonAscii(glyphs);
    assert.ok(chars.length > 0, `tier row "${label}" lists no glyphs`);
    const counts = chars.map(coverage);
    assert.ok(counts.every((c) => c !== undefined), `tier row "${label}" has glyphs outside the fixture`);
    assert.equal(Number(total), N);
    assert.equal(Number(lo), Math.min(...counts), `tier row "${label}": printed low does not match the fixture`);
    assert.equal(hi === undefined ? Math.min(...counts) : Number(hi), Math.max(...counts),
      `tier row "${label}": printed high does not match the fixture`);
  }
});

test("the extended reference publishes its own measured counts", () => {
  const rows = [...extendedDoc.matchAll(COUNT_ROW)];
  assert.equal(rows.length, 15, "expected 5 Greek subscripts, 5 Greek superscripts, 5 Latin");
  for (const [, glyph, cp, have, total] of rows) {
    assert.equal(key(glyph), cp, `extended row prints ${glyph} but labels it ${cp}`);
    assert.equal(Number(total), N);
    assert.equal(Number(have), coverage(glyph), `printed count for ${glyph} does not match the fixture`);
  }
  // Superscript theta renders as widely as the portable Latin blocks, so it is
  // not an opt-in glyph and must not be relisted here.
  assert.doesNotMatch(extendedDoc, /^\| ᶿ \|/mu, "ᶿ belongs in the portable set");
});

test("no public file promises coverage the fonts do not deliver", () => {
  // docs/index.md sat outside this corpus and claimed math renders in every
  // terminal while Ubuntu's own default font carries none of the letter scripts.
  for (const file of ["README.md", "docs/index.md", "package.json",
                      ".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
    const text = read(...file.split("/"));
    assert.doesNotMatch(text, /every terminal|any terminal|all terminals/i, `${file} overpromises terminal coverage`);
    assert.doesNotMatch(text, /openai\/codex\/issues\/15865/, `${file} links an issue closed as a duplicate`);
  }
});
