import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const skill = readFileSync(join(root, "skills", "math-unicode", "SKILL.md"), "utf8");
const extended = readFileSync(
  join(root, "skills", "math-unicode", "references", "extended-glyphs.md"),
  "utf8",
);

test("quick reference uses a real sum operator and thin-space grouping", () => {
  assert.match(skill, /^description: Use when a response needs mathematical notation/m);
  assert.match(skill, /^disable-model-invocation: false$/m);
  assert.match(skill, /‖x‖₂ = √\(∑\[i=1\.\.n\] xᵢ²\)/);
  assert.doesNotMatch(skill, /√\(Σᵢ xᵢ²\)/);
  assert.ok(skill.includes("5\u2009238"), "thousands examples should contain U+2009 THIN SPACE");
});

test("golden corpus preserves difficult terminal-native formulas", () => {
  const formulas = [
    "I_ν(z) = (z/2)^ν / (√π Γ(ν+½)) ∫[0..π] e^(±z cos θ)(sin θ)^(2ν) dθ",
    "F(a,b;c;z) = 1 / (Γ(b)Γ(c−b)) ∫[0..1] t^(b−1)(1−t)^(c−b−1) / (1−zt)^a dt",
    "T_N(b,z) = ∑[m₁+...+mₙ=N] ((b₁)_{m₁} ··· (bₙ)_{mₙ}) / (m₁! ··· mₙ!) · z₁^(m₁) ··· zₙ^(mₙ)",
    "θ(z | Ω) = ∑[n ∈ ℤ^g] exp(2π i(½ n · Ω · n + n · z))",
    "R^ρ_{σμν} = ∂_μ Γ^ρ_{νσ} − ∂_ν Γ^ρ_{μσ} + Γ^ρ_{μλ} Γ^λ_{νσ} − Γ^ρ_{νλ} Γ^λ_{μσ}",
    "f^(n)(z₀) = n! / (2π i) ∫[C] f(z) / (z−z₀)^(n+1) dz",
    "∂u/∂t + (u · ∇)u = −∇p + νΔu + f,  ∇·u = 0",
    "p(x) = exp(−½ (x−μ)ᵀΣ⁻¹(x−μ)) / √((2π)ᵈ det Σ)",
    "F(ω) = ∫[−∞..∞] f(t)e^(−iωt) dt",
    "⎧ x²    if x ≥ 0",
  ];

  for (const formula of formulas) {
    assert.ok(skill.includes(formula), `missing canonical formula: ${formula}`);
  }
});

test("public descriptions do not promise unsupported terminal coverage", () => {
  const publicText = [
    readFileSync(join(root, "README.md"), "utf8"),
    readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"),
    readFileSync(join(root, ".codex-plugin", "plugin.json"), "utf8"),
  ].join("\n");

  assert.doesNotMatch(publicText, /every terminal already renders|works in every terminal|any terminal/i);
  assert.match(publicText, /Unicode-capable terminal/i);
  assert.match(publicText, /`\/math-unicode`/);
});

test("glyph blocks list the capital superscripts the rules actually use", () => {
  // Rule 4 and the golden corpus emit xᵀ, but the reference block listed no
  // capitals at all, so the model had to guess whether A^S had a glyph.
  assert.match(skill, /^sup \(capital\) .*ᴬ ᴮ ᴰ ᴱ ᴳ ᴴ ᴵ ᴶ ᴷ ᴸ ᴹ ᴺ ᴼ ᴾ ᴿ ᵀ ᵁ ⱽ ᵂ/m);
});

test("skill names the glyphs that do not exist, not only the ones that do", () => {
  // A whitelist alone is not a membership test: the fallbacks in Rules 3-5
  // only fire if the model knows which characters have no form.
  assert.match(skill, /Do not invent or approximate a missing glyph/);
  assert.match(skill, /No Unicode code point exists at all/);
  assert.match(skill, /subscript letters\s+b c d f g q w y z/);
  assert.match(skill, /subscript capitals\s+all 26/);
  assert.match(skill, /superscript capitals\s+X Y Z/);
  assert.match(skill, /superscript ∞\s+none/);
  assert.ok(
    skill.includes("17/26") && skill.includes("0/26") && skill.includes("19/26"),
    "state measured coverage so the gap is checkable, not folklore",
  );
});

test("a missing font is not reported as a missing code point", () => {
  // The old gap list collapsed two different causes into "no glyph exists",
  // which made three of its own examples wrong.
  assert.match(skill, /A code point exists, but no monospace font in the measured set ships it/);
  // U+A7F1 shipped in Unicode 17.0, so superscript S is a font gap now.
  assert.match(skill, /superscript S\s+U\+A7F1, Unicode 17\.0/);
  assert.doesNotMatch(skill, /superscript capitals\s+S X Y Z/, "S has had a code point since Unicode 17.0");
  // Superscript theta and subscript rho both exist; only one of them renders.
  assert.match(skill, /`ᶿ` \(superscript θ, U\+1DBF\)/);
  assert.match(skill, /`ρ` does\s*\n?have a subscript, `ᵨ` U\+1D68/);
  assert.match(skill, /^sup \(Greek\) {4}ᶿ/m, "theta belongs in the portable block it renders in");
});

test("activation is scoped to surfaces that cannot render LaTeX", () => {
  // Issue #18: the description is the only text a host matches against, and it
  // used to trigger on content alone, including on hosts that render math.
  assert.match(skill, /^description: .*terminal or TUI that cannot render LaTeX/m);
  assert.match(skill, /^description: .*Do not use when the host renders math natively/m);
  assert.match(skill, /Surfaces that render math natively \(do not apply the skill\)/);
  assert.match(skill, /No host exposes a per-surface predicate to a skill today/);
});

test("the extended glyph set is opt-in and leaves the big-operator rule alone", () => {
  // Issue #19: wider coverage for single-character scripts only.
  assert.match(skill, /references\/extended-glyphs\.md/);
  assert.match(extended, /^# Extended glyph coverage$/m);
  assert.match(extended, /Use extended glyph coverage from math-unicode/);
  assert.match(extended, /Rule 5 is unchanged/);
  assert.match(extended, /Rule 13 is unchanged/);
  assert.doesNotMatch(extended, /∫₀\^∞ is fine|stacked bounds are fine/);
});

test("no public text promises a graphics-rendering roadmap", () => {
  // Native TUI renderers are landing upstream (codex#18906, claude-code#44479);
  // a separate render CLI is not a race this skill can win.
  const publicText = [
    readFileSync(join(root, "README.md"), "utf8"),
    readFileSync(join(root, "docs", "index.md"), "utf8"),
    readFileSync(join(root, "package.json"), "utf8"),
    readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"),
    readFileSync(join(root, ".codex-plugin", "plugin.json"), "utf8"),
  ].join("\n");

  assert.doesNotMatch(publicText, /on the roadmap/i);
  assert.doesNotMatch(publicText, /roadmap \(not built yet\)/i);
});

test("related issues point at the live upstream threads", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");

  assert.match(readme, /openai\/codex\/issues\/18906/);
  assert.doesNotMatch(readme, /openai\/codex\/issues\/15865/, "closed as a duplicate");
});
