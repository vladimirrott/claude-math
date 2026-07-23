import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, "..", "bin", "claude-math.js");
const PLUGIN_ROOT = join(__dirname, "..");
const PLUGIN_ID = "claude-math@local";
const CODEX_MARKER = ".claude-math-install.json";

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "claude-math-test-"));
  return {
    dir,
    target: join(dir, "plugins", "local", "claude-math"),
    settings: join(dir, "settings.json"),
    installed: join(dir, "plugins", "installed_plugins.json"),
    run(...cliArgs) {
      return execFileSync(process.execPath, [CLI, ...cliArgs], {
        env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
        encoding: "utf8",
      });
    },
    cleanup() { rmSync(dir, { recursive: true, force: true }); },
  };
}

function readState(sb) {
  return {
    target: existsSync(sb.target) || !!safeLstat(sb.target),
    targetIsSymlink: safeLstat(sb.target)?.isSymbolicLink() ?? false,
    settings: existsSync(sb.settings) ? JSON.parse(readFileSync(sb.settings, "utf8")) : null,
    installed: existsSync(sb.installed) ? JSON.parse(readFileSync(sb.installed, "utf8")) : null,
  };
}

function safeLstat(p) { try { return lstatSync(p); } catch { return null; } }

test("install creates symlink + writes both JSON files", () => {
  const sb = sandbox();
  try {
    sb.run("install");
    const s = readState(sb);
    assert.equal(s.targetIsSymlink, true);
    assert.equal(s.settings.enabledPlugins[PLUGIN_ID], true);
    assert.equal(s.installed.plugins[PLUGIN_ID][0].version, JSON.parse(readFileSync(join(PLUGIN_ROOT, "package.json"))).version);
    assert.equal(s.installed.plugins[PLUGIN_ID][0].installPath, sb.target);
  } finally { sb.cleanup(); }
});

test("install is idempotent", () => {
  const sb = sandbox();
  try {
    sb.run("install");
    const first = readState(sb);
    sb.run("install");
    const second = readState(sb);
    assert.equal(first.installed.plugins[PLUGIN_ID][0].installedAt,
                 second.installed.plugins[PLUGIN_ID][0].installedAt,
                 "installedAt should be preserved across reinstalls");
    assert.notEqual(first.installed.plugins[PLUGIN_ID][0].lastUpdated,
                    second.installed.plugins[PLUGIN_ID][0].lastUpdated,
                    "lastUpdated should advance");
  } finally { sb.cleanup(); }
});

test("uninstall reverses install", () => {
  const sb = sandbox();
  try {
    sb.run("install");
    sb.run("uninstall");
    const s = readState(sb);
    assert.equal(safeLstat(sb.target), null);
    assert.equal(s.settings.enabledPlugins?.[PLUGIN_ID], undefined);
    assert.equal(s.installed.plugins?.[PLUGIN_ID], undefined);
  } finally { sb.cleanup(); }
});

test("status reports current state", () => {
  const sb = sandbox();
  try {
    const before = sb.run("status");
    assert.match(before, /target:.*✗/);
    assert.match(before, /enabled:.*✗/);
    sb.run("install");
    const after = sb.run("status");
    assert.match(after, /target:.*✓/);
    assert.match(after, /valid:\s+✓/);
    assert.match(after, /enabled:.*✓/);
  } finally { sb.cleanup(); }
});

test("--version prints version from package.json", () => {
  const sb = sandbox();
  try {
    const v = sb.run("--version").trim();
    const pkgV = JSON.parse(readFileSync(join(PLUGIN_ROOT, "package.json"))).version;
    assert.equal(v, pkgV);
  } finally { sb.cleanup(); }
});

test("atomic write: no .tmp leftover after success", () => {
  const sb = sandbox();
  try {
    sb.run("install");
    const stray = readdirSync(sb.dir, { recursive: true }).filter((f) => String(f).includes(".tmp-"));
    assert.deepEqual(stray, []);
  } finally { sb.cleanup(); }
});

test("backup files created on first mutation", () => {
  const sb = sandbox();
  try {
    writeFileSync(sb.settings, JSON.stringify({ existingKey: "preserve-me" }, null, 2));
    sb.run("install");
    const bak = `${sb.settings}.claude-math.bak`;
    assert.equal(existsSync(bak), true, "settings backup should exist");
    const original = JSON.parse(readFileSync(bak, "utf8"));
    assert.equal(original.existingKey, "preserve-me");
    // Live settings must still carry the pre-existing key
    const live = JSON.parse(readFileSync(sb.settings, "utf8"));
    assert.equal(live.existingKey, "preserve-me");
    assert.equal(live.enabledPlugins[PLUGIN_ID], true);
  } finally { sb.cleanup(); }
});

test("--copy forces a real directory, not a symlink", () => {
  const sb = sandbox();
  try {
    sb.run("install", "--copy");
    const stat = safeLstat(sb.target);
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(existsSync(join(sb.target, ".claude-plugin", "plugin.json")), true);
    assert.equal(existsSync(join(sb.target, "skills", "math-unicode", "SKILL.md")), true);
    // Uninstall must handle copied directories too
    sb.run("uninstall");
    assert.equal(safeLstat(sb.target), null);
  } finally { sb.cleanup(); }
});

test("install refuses to clobber a foreign symlink without --force", () => {
  const sb = sandbox();
  try {
    // Plant a symlink pointing somewhere else
    const decoy = mkdtempSync(join(tmpdir(), "claude-math-decoy-"));
    try {
      mkdirSync(join(sb.dir, "plugins", "local"), { recursive: true });
      symlinkSync(decoy, sb.target, "dir");
      assert.throws(() => sb.run("install"), /Re-run with --force/);
      sb.run("install", "--force");
      const after = safeLstat(sb.target);
      assert.equal(after.isSymbolicLink(), true);
    } finally { rmSync(decoy, { recursive: true, force: true }); }
  } finally { sb.cleanup(); }
});

test("install recognizes a relative symlink to this plugin as its own", () => {
  const sb = sandbox();
  try {
    mkdirSync(join(sb.dir, "plugins", "local"), { recursive: true });
    symlinkSync(relative(dirname(sb.target), PLUGIN_ROOT), sb.target, "dir");
    assert.doesNotThrow(() => sb.run("install"));
    sb.run("uninstall");
    assert.equal(safeLstat(sb.target), null);
  } finally { sb.cleanup(); }
});

test("uninstall leaves a foreign symlink without --force", () => {
  const sb = sandbox();
  try {
    const decoy = mkdtempSync(join(tmpdir(), "claude-math-decoy-"));
    try {
      mkdirSync(join(sb.dir, "plugins", "local"), { recursive: true });
      symlinkSync(decoy, sb.target, "dir");
      const out = sb.run("uninstall");
      assert.match(out, /not our plugin — leaving alone/);
      assert.equal(safeLstat(sb.target)?.isSymbolicLink(), true);
    } finally { rmSync(decoy, { recursive: true, force: true }); }
  } finally { sb.cleanup(); }
});

function codexSandbox() {
  const dir = mkdtempSync(join(tmpdir(), "claude-math-codex-"));
  const skillsDir = join(dir, "skills");
  return {
    dir,
    target: join(skillsDir, "math-unicode"),
    skill: join(skillsDir, "math-unicode", "SKILL.md"),
    run(...cliArgs) {
      return execFileSync(process.execPath, [CLI, ...cliArgs], {
        env: { ...process.env, CLAUDE_MATH_CODEX_SKILLS_DIR: skillsDir },
        encoding: "utf8",
      });
    },
    cleanup() { rmSync(dir, { recursive: true, force: true }); },
  };
}

test("install --codex drops the skill into the Codex skills dir", () => {
  const sb = codexSandbox();
  try {
    sb.run("install", "--codex");
    assert.equal(existsSync(sb.skill), true, "SKILL.md should be installed");
    assert.match(readFileSync(sb.skill, "utf8"), /name:\s*math-unicode/);
    const marker = JSON.parse(readFileSync(join(sb.target, CODEX_MARKER), "utf8"));
    assert.equal(marker.package, "claude-math");
    assert.equal(marker.skill, "math-unicode");
  } finally { sb.cleanup(); }
});

test("uninstall --codex removes the skill", () => {
  const sb = codexSandbox();
  try {
    sb.run("install", "--codex");
    sb.run("uninstall", "--codex");
    assert.equal(existsSync(sb.target), false);
  } finally { sb.cleanup(); }
});

test("status --codex reports install state", () => {
  const sb = codexSandbox();
  try {
    assert.match(sb.run("status", "--codex"), /codex skill:.*✗/);
    sb.run("install", "--codex");
    const out = sb.run("status", "--codex");
    assert.match(out, /codex skill:.*✓/);
    assert.match(out, /codex owner:.*✓/);
  } finally { sb.cleanup(); }
});

test("install --codex refuses to clobber a foreign valid skill directory without --force", () => {
  const sb = codexSandbox();
  try {
    mkdirSync(sb.target, { recursive: true });
    writeFileSync(sb.skill, "---\nname: math-unicode\n---\n\nA different skill.");
    assert.throws(() => sb.run("install", "--codex"), /--force/);
    sb.run("install", "--codex", "--force");
    assert.equal(existsSync(sb.skill), true);
  } finally { sb.cleanup(); }
});

test("uninstall --codex leaves a foreign valid skill directory without --force", () => {
  const sb = codexSandbox();
  try {
    mkdirSync(sb.target, { recursive: true });
    writeFileSync(sb.skill, "---\nname: math-unicode\n---\n\nA different skill.");
    const out = sb.run("uninstall", "--codex");
    assert.match(out, /not our skill — leaving alone/);
    assert.equal(existsSync(sb.skill), true);
  } finally { sb.cleanup(); }
});

test("prepack syncs plugin.json version", () => {
  const sb = sandbox();
  try {
    const out = sb.run("prepack");
    assert.match(out, /(plugin\.json|already at)/);
    const pj = JSON.parse(readFileSync(join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8"));
    const pkgV = JSON.parse(readFileSync(join(PLUGIN_ROOT, "package.json"))).version;
    assert.equal(pj.version, pkgV);
  } finally { sb.cleanup(); }
});
