#!/usr/bin/env node
// claude-math — install/uninstall the plugin into Claude Code's local plugin dir.

import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
const TARGET_LINK = join(LOCAL_DIR, PLUGIN_NAME);
const SETTINGS = join(CLAUDE_DIR, "settings.json");
const INSTALLED = join(PLUGINS_DIR, "installed_plugins.json");

const pkg = JSON.parse(readFileSync(join(PLUGIN_ROOT, "package.json"), "utf8"));

function log(msg) { console.log(`[claude-math] ${msg}`); }
function die(msg) { console.error(`[claude-math] ${msg}`); process.exit(1); }

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { die(`could not parse ${path}: ${e.message}`); }
}

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

function ensureSymlink() {
  mkdirSync(LOCAL_DIR, { recursive: true });
  if (existsSync(TARGET_LINK) || lstatSyncSafe(TARGET_LINK)) {
    const stat = lstatSync(TARGET_LINK);
    if (stat.isSymbolicLink()) {
      unlinkSync(TARGET_LINK);
    } else {
      die(`${TARGET_LINK} exists and is not a symlink — refusing to overwrite.`);
    }
  }
  symlinkSync(PLUGIN_ROOT, TARGET_LINK, "dir");
  log(`linked ${PLUGIN_ROOT} → ${TARGET_LINK}`);
}

function lstatSyncSafe(p) {
  try { return lstatSync(p); } catch { return null; }
}

function registerInstalled() {
  const data = readJson(INSTALLED, { version: 2, plugins: {} });
  if (!data.plugins) data.plugins = {};
  const now = new Date().toISOString();
  data.plugins[PLUGIN_ID] = [{
    scope: "user",
    installPath: TARGET_LINK,
    version: pkg.version,
    installedAt: data.plugins[PLUGIN_ID]?.[0]?.installedAt ?? now,
    lastUpdated: now,
  }];
  writeJson(INSTALLED, data);
  log(`registered ${PLUGIN_ID} in ${INSTALLED}`);
}

function enableInSettings() {
  const data = readJson(SETTINGS, {});
  if (!data.enabledPlugins) data.enabledPlugins = {};
  data.enabledPlugins[PLUGIN_ID] = true;
  writeJson(SETTINGS, data);
  log(`enabled ${PLUGIN_ID} in ${SETTINGS}`);
}

function unregister() {
  if (existsSync(TARGET_LINK) && lstatSync(TARGET_LINK).isSymbolicLink()) {
    unlinkSync(TARGET_LINK);
    log(`removed symlink ${TARGET_LINK}`);
  }
  const installed = readJson(INSTALLED, null);
  if (installed?.plugins?.[PLUGIN_ID]) {
    delete installed.plugins[PLUGIN_ID];
    writeJson(INSTALLED, installed);
    log(`unregistered ${PLUGIN_ID}`);
  }
  const settings = readJson(SETTINGS, null);
  if (settings?.enabledPlugins?.[PLUGIN_ID] !== undefined) {
    delete settings.enabledPlugins[PLUGIN_ID];
    writeJson(SETTINGS, settings);
    log(`disabled ${PLUGIN_ID}`);
  }
}

function install() {
  ensureSymlink();
  registerInstalled();
  enableInSettings();
  log("done. Restart Claude Code to load the skill.");
}

function uninstall() {
  unregister();
  log("done. Restart Claude Code to drop the skill.");
}

function help() {
  console.log(`claude-math v${pkg.version}

Usage:
  claude-math install      Symlink the plugin into ~/.claude/plugins/local/ and enable it.
  claude-math uninstall    Remove the symlink and disable the plugin.
  claude-math status       Show install state.
  claude-math --version    Print version.
  claude-math --help       This help.

Override the Claude config dir with CLAUDE_CONFIG_DIR.
`);
}

function status() {
  const linked = lstatSyncSafe(TARGET_LINK)?.isSymbolicLink() ?? false;
  const installed = !!readJson(INSTALLED, { plugins: {} }).plugins?.[PLUGIN_ID];
  const enabled = readJson(SETTINGS, {}).enabledPlugins?.[PLUGIN_ID] === true;
  console.log(`symlink:   ${linked ? "✓" : "✗"} ${TARGET_LINK}`);
  console.log(`installed: ${installed ? "✓" : "✗"} ${INSTALLED}`);
  console.log(`enabled:   ${enabled ? "✓" : "✗"} ${SETTINGS}`);
}

const cmd = process.argv[2];
switch (cmd) {
  case "install": install(); break;
  case "uninstall":
  case "remove": uninstall(); break;
  case "status": status(); break;
  case "--version":
  case "-v": console.log(pkg.version); break;
  case "--help":
  case "-h":
  case undefined: help(); break;
  default: die(`unknown command: ${cmd}. Run 'claude-math --help'.`);
}
