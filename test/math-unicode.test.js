import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const skill = readFileSync(join(root, "skills", "math-unicode", "SKILL.md"), "utf8");

test("quick reference uses a real sum operator and thin-space grouping", () => {
  assert.match(skill, /^description: This skill must be used whenever a response needs mathematical notation/m);
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
    "f^(n)(z₀) = n! / (2π i) ∮[C] f(z) / (z−z₀)^(n+1) dz",
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
