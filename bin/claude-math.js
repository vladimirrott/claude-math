#!/usr/bin/env node
// claude-math — install/uninstall the plugin into Claude Code's local plugin dir.

import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = resolve(__dirname, "..");
const PLUGIN_NAME = "claude-math";
const PLUGIN_ID = `${PLUGIN_NAME}@local`;

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const PLUGINS_DIR = join(CLAUDE_DIR, "plugins");
const LOCAL_DIR = join(PLUGINS_DIR, "local");
const TARGET = join(LOCAL_DIR, PLUGIN_NAME);
const SETTINGS = join(CLAUDE_DIR, "settings.json");
const INSTALLED = join(PLUGINS_DIR, "installed_plugins.json");

const pkg = JSON.parse(readFileSync(join(PLUGIN_ROOT, "package.json"), "utf8"));

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("-")));
const cmd = args.find((a) => !a.startsWith("-"));
const FORCE = flags.has("--force") || flags.has("-f");
const FORCE_COPY = flags.has("--copy");

function log(msg) { console.log(`[claude-math] ${msg}`); }
function die(msg) { console.error(`[claude-math] ${msg}`); process.exit(1); }

function lstatSafe(p) { try { return lstatSync(p); } catch { return null; } }

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { die(`could not parse ${path}: ${e.message}`); }
}

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  renameSync(tmp, path);
}

function backupOnce(path) {
  const bak = `${path}.claude-math.bak`;
  if (existsSync(path) && !existsSync(bak)) {
    copyFileSync(path, bak);
    log(`backed up ${path} → ${bak}`);
  }
}

function isEphemeralPath(p) {
  return /[\\/](?:_npx|_npm-cache)[\\/]/.test(p);
}

function looksLikeOurPlugin(path) {
  return existsSync(join(path, ".claude-plugin", "plugin.json"))
      && existsSync(join(path, "skills", "math-unicode", "SKILL.md"));
}

function chooseMode() {
  if (FORCE_COPY) return "copy";
  if (isEphemeralPath(PLUGIN_ROOT)) return "copy";
  if (process.platform === "win32") return "junction";
  return "symlink";
}

function clearTarget() {
  const stat = lstatSafe(TARGET);
  if (!stat) return;

  if (stat.isSymbolicLink()) {
    let current = "";
    try { current = readlinkSync(TARGET); } catch {}
    if (current === PLUGIN_ROOT || FORCE) {
      unlinkSync(TARGET);
      return;
    }
    die(`${TARGET} is a symlink to ${current}, not ${PLUGIN_ROOT}. Re-run with --force to overwrite.`);
  }

  if (stat.isDirectory()) {
    if (!looksLikeOurPlugin(TARGET) && !FORCE) {
      die(`${TARGET} is a directory but does not look like a claude-math install. Inspect manually, then re-run with --force.`);
    }
    rmSync(TARGET, { recursive: true, force: true });
    return;
  }

  die(`${TARGET} exists and is neither symlink nor directory. Refusing to touch.`);
}

function placePlugin(mode) {
  mkdirSync(LOCAL_DIR, { recursive: true });
  if (mode === "copy") {
    cpSync(PLUGIN_ROOT, TARGET, {
      recursive: true,
      filter: (src) => {
        const rel = relative(PLUGIN_ROOT, src);
        if (!rel) return true;
        const top = rel.split(/[\\/]/, 1)[0];
        return !["node_modules", ".git", "test", "tests"].includes(top);
      },
    });
    log(`copied ${PLUGIN_ROOT} → ${TARGET}`);
    return;
  }
  const linkType = mode === "junction" ? "junction" : "dir";
  symlinkSync(PLUGIN_ROOT, TARGET, linkType);
  log(`linked ${PLUGIN_ROOT} → ${TARGET} (${mode})`);
}

function registerInstalled() {
  backupOnce(INSTALLED);
  const data = readJson(INSTALLED, { version: 2, plugins: {} });
  if (!data.plugins) data.plugins = {};
  const now = new Date().toISOString();
  const prev = data.plugins[PLUGIN_ID]?.[0];
  data.plugins[PLUGIN_ID] = [{
    scope: "user",
    installPath: TARGET,
    version: pkg.version,
    installedAt: prev?.installedAt ?? now,
    lastUpdated: now,
  }];
  writeJsonAtomic(INSTALLED, data);
  log(`registered ${PLUGIN_ID}`);
}

function enableInSettings() {
  backupOnce(SETTINGS);
  const data = readJson(SETTINGS, {});
  if (!data.enabledPlugins) data.enabledPlugins = {};
  data.enabledPlugins[PLUGIN_ID] = true;
  writeJsonAtomic(SETTINGS, data);
  log(`enabled ${PLUGIN_ID}`);
}

function removeTarget() {
  const stat = lstatSafe(TARGET);
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    unlinkSync(TARGET);
    log(`removed symlink ${TARGET}`);
    return;
  }
  if (stat.isDirectory() && (looksLikeOurPlugin(TARGET) || FORCE)) {
    rmSync(TARGET, { recursive: true, force: true });
    log(`removed directory ${TARGET}`);
    return;
  }
  log(`${TARGET} exists but is not our plugin — leaving alone (use --force to remove anyway)`);
}

function unregister() {
  const installed = readJson(INSTALLED, null);
  if (installed?.plugins?.[PLUGIN_ID]) {
    delete installed.plugins[PLUGIN_ID];
    writeJsonAtomic(INSTALLED, installed);
    log(`unregistered ${PLUGIN_ID}`);
  }
  const settings = readJson(SETTINGS, null);
  if (settings?.enabledPlugins?.[PLUGIN_ID] !== undefined) {
    delete settings.enabledPlugins[PLUGIN_ID];
    writeJsonAtomic(SETTINGS, settings);
    log(`disabled ${PLUGIN_ID}`);
  }
}

function install() {
  const mode = chooseMode();
  clearTarget();
  placePlugin(mode);
  registerInstalled();
  enableInSettings();
  log("done. Restart Claude Code to load the skill.");
}

function uninstall() {
  removeTarget();
  unregister();
  log("done. Restart Claude Code to drop the skill.");
}

function status() {
  const stat = lstatSafe(TARGET);
  const kind = !stat ? "missing"
    : stat.isSymbolicLink() ? "symlink"
    : stat.isDirectory() ? "directory"
    : "other";
  const installed = !!readJson(INSTALLED, { plugins: {} }).plugins?.[PLUGIN_ID];
  const enabled = readJson(SETTINGS, {}).enabledPlugins?.[PLUGIN_ID] === true;
  const valid = stat ? looksLikeOurPlugin(TARGET) : false;
  console.log(`target:    ${kind === "missing" ? "✗" : "✓"} ${TARGET} (${kind})`);
  console.log(`valid:     ${valid ? "✓" : "✗"} plugin files present`);
  console.log(`installed: ${installed ? "✓" : "✗"} ${INSTALLED}`);
  console.log(`enabled:   ${enabled ? "✓" : "✗"} ${SETTINGS}`);
  console.log(`mode:      ${chooseMode()} (would-be on next install)`);
}

function prepack() {
  const pluginJsonPath = join(PLUGIN_ROOT, ".claude-plugin", "plugin.json");
  const pj = JSON.parse(readFileSync(pluginJsonPath, "utf8"));
  if (pj.version !== pkg.version) {
    pj.version = pkg.version;
    writeFileSync(pluginJsonPath, JSON.stringify(pj, null, 2) + "\n");
    log(`synced plugin.json version → ${pkg.version}`);
  } else {
    log(`plugin.json already at ${pkg.version}`);
  }
}

function help() {
  console.log(`claude-math v${pkg.version}

Usage:
  claude-math install [--force] [--copy]
      Symlink (or copy) the plugin into ~/.claude/plugins/local/ and enable it.
      Auto-copies if invoked via npx; auto-junctions on Windows.
        --force   Overwrite an existing install at the target path.
        --copy    Force copy mode even on supported platforms.

  claude-math uninstall [--force]
      Remove the plugin and disable it. --force lets it remove a directory
      that does not look like a claude-math install.

  claude-math status
      Show install state, target kind, and which mode would be used.

  claude-math prepack
      Sync .claude-plugin/plugin.json version from package.json. Runs as an
      npm \`prepack\` hook; safe to run manually.

  claude-math --version
  claude-math --help

Env:
  CLAUDE_CONFIG_DIR   Override the Claude config directory (default ~/.claude).
`);
}

switch (cmd) {
  case "install": install(); break;
  case "uninstall":
  case "remove": uninstall(); break;
  case "status": status(); break;
  case "prepack": prepack(); break;
  case undefined:
    if (flags.has("--version") || flags.has("-v")) { console.log(pkg.version); break; }
    help(); break;
  default: die(`unknown command: ${cmd}. Run 'claude-math --help'.`);
}
