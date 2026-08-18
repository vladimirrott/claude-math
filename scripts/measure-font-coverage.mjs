#!/usr/bin/env node
// Measure how many monospace fonts carry each glyph the math-unicode skill emits.
//
// The skill recommends glyphs; whether a terminal can draw them is a property of
// the font, not of Unicode. This script reads the `cmap` table of each font file
// directly (no dependencies) and writes the counts to
// test/fixtures/font-coverage.json, which the test suite asserts against.
//
// Usage:
//   node scripts/measure-font-coverage.mjs <font-file>...
//   node scripts/measure-font-coverage.mjs --fonts fonts.json
//
// The committed fixture was produced from the font set recorded in its
// `fonts` array. Regenerate it only with an equivalent or wider set: shrinking
// the sample silently weakens every guard that reads it.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = join(ROOT, "skills", "math-unicode", "SKILL.md");
const EXTENDED = join(ROOT, "skills", "math-unicode", "references", "extended-glyphs.md");
const OUT = join(ROOT, "test", "fixtures", "font-coverage.json");

// ---------------------------------------------------------------- TrueType

function u16(b, o) { return (b[o] << 8) | b[o + 1]; }
function u32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }

function tableOffset(buf, tag) {
  let base = 0;
  if (u32(buf, 0) === 0x74746366) base = u32(buf, 12); // 'ttcf': use the first face
  const numTables = u16(buf, base + 4);
  for (let i = 0; i < numTables; i++) {
    const rec = base + 12 + i * 16;
    const name = String.fromCharCode(buf[rec], buf[rec + 1], buf[rec + 2], buf[rec + 3]);
    if (name === tag) return u32(buf, rec + 8);
  }
  return null;
}

// Format 4 covers the BMP; format 12 covers the full range. Fonts ship one or
// both, so read every subtable and union the results.
function readFormat4(buf, off, set) {
  const segX2 = u16(buf, off + 6);
  const segs = segX2 / 2;
  const endO = off + 14;
  const startO = endO + segX2 + 2;
  const deltaO = startO + segX2;
  const rangeO = deltaO + segX2;
  for (let s = 0; s < segs; s++) {
    const end = u16(buf, endO + s * 2);
    const start = u16(buf, startO + s * 2);
    if (start > end || start === 0xffff) continue;
    const delta = u16(buf, deltaO + s * 2);
    const rangeOff = u16(buf, rangeO + s * 2);
    for (let c = start; c <= end; c++) {
      let g;
      if (rangeOff === 0) {
        g = (c + delta) & 0xffff;
      } else {
        const gi = rangeO + s * 2 + rangeOff + (c - start) * 2;
        if (gi + 1 >= buf.length) continue;
        g = u16(buf, gi);
        if (g !== 0) g = (g + delta) & 0xffff;
      }
      if (g !== 0) set.add(c);
    }
  }
}

function readFormat12(buf, off, set) {
  const nGroups = u32(buf, off + 12);
  for (let i = 0; i < nGroups; i++) {
    const g = off + 16 + i * 12;
    const start = u32(buf, g);
    const end = u32(buf, g + 4);
    const startGid = u32(buf, g + 8);
    if (startGid === 0 && start === 0) continue;
    for (let c = start; c <= end && c - start < 0x10000; c++) set.add(c);
  }
}

function charset(file) {
  const buf = readFileSync(file);
  const cmap = tableOffset(buf, "cmap");
  if (cmap === null) throw new Error(`${file}: no cmap table`);
  const set = new Set();
  const n = u16(buf, cmap + 2);
  for (let i = 0; i < n; i++) {
    const rec = cmap + 4 + i * 8;
    const sub = cmap + u32(buf, rec + 4);
    const format = u16(buf, sub);
    if (format === 4) readFormat4(buf, sub, set);
    else if (format === 12) readFormat12(buf, sub, set);
  }
  return set;
}

// Read the typographic family from the `name` table so the fixture records what
// was measured rather than whatever the file happened to be called.
function familyName(file) {
  const buf = readFileSync(file);
  const name = tableOffset(buf, "name");
  if (name === null) return basename(file);
  const count = u16(buf, name + 2);
  const stringOffset = u16(buf, name + 4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const rec = name + 6 + i * 12;
    const nameId = u16(buf, rec + 6);
    if (nameId !== 1) continue;
    const platformId = u16(buf, rec);
    const length = u16(buf, rec + 8);
    const offset = u16(buf, rec + 10);
    const start = name + stringOffset + offset;
    const raw = buf.subarray(start, start + length);
    const text = platformId === 3 ? raw.swap16().toString("utf16le") : raw.toString("latin1");
    if (platformId === 3) best = text;
    else best ??= text;
  }
  return best ?? basename(file);
}

// ------------------------------------------------------------------- glyphs

// Everything from `## Glyphs to avoid` onward exists to name what fails: the
// avoid list and the anti-pattern block. Glyphs there are counter-examples, not
// recommendations, and the two sides get asserted in opposite directions.
export const AVOID_HEADING = "## Glyphs to avoid";

export function nonAscii(text) {
  return [...new Set([...text].filter((c) => c.codePointAt(0) > 0x7f))]
    .sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

export function splitSkill(skillText) {
  const at = skillText.indexOf(AVOID_HEADING);
  if (at === -1) throw new Error(`SKILL.md is missing the "${AVOID_HEADING}" heading`);
  const recommended = nonAscii(skillText.slice(0, at));
  const recommendedSet = new Set(recommended);
  const avoided = nonAscii(skillText.slice(at)).filter((c) => !recommendedSet.has(c));
  return { recommended, avoided, all: nonAscii(skillText) };
}

// --------------------------------------------------------------------- main

// Importing this module must stay side-effect free: the test suite pulls
// splitSkill() and nonAscii() out of it so the guard and the generator cannot
// drift apart on what counts as a recommended glyph.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let files = args;
  const fontsFlag = args.indexOf("--fonts");
  if (fontsFlag !== -1) files = JSON.parse(readFileSync(args[fontsFlag + 1], "utf8"));
  if (files.length === 0) {
    console.error("usage: measure-font-coverage.mjs <font-file>... | --fonts fonts.json");
    process.exit(1);
  }

  const fonts = files.map((file) => ({
    family: familyName(file),
    file: basename(file),
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16),
    set: charset(file),
  }));

  const { recommended, avoided, all } = splitSkill(readFileSync(SKILL, "utf8"));

  // The extended reference is opt-in by definition, so its glyphs are measured and
  // published but never asserted as part of the portable set.
  const known = new Set([...recommended, ...avoided]);
  const extended = existsSync(EXTENDED)
    ? nonAscii(readFileSync(EXTENDED, "utf8")).filter((c) => !known.has(c))
    : [];

  const key = (g) => `U+${g.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
  const coverage = {};
  for (const g of [...all, ...extended]) {
    coverage[key(g)] = fonts.filter((f) => f.set.has(g.codePointAt(0))).length;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        _comment: "Generated by scripts/measure-font-coverage.mjs. Do not hand-edit.",
        fontCount: fonts.length,
        fonts: fonts.map(({ family, file, sha256 }) => ({ family, file, sha256 })),
        recommended: recommended.map(key),
        avoided: avoided.map(key),
        extended: extended.map(key),
        coverage,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `[measure-font-coverage] ${recommended.length} recommended + ${avoided.length} avoided + ` +
      `${extended.length} extended glyphs across ${fonts.length} fonts -> ${OUT}`,
  );
}
