# Changelog

All notable changes to `claude-math` documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [0.1.0] — 2026-05-20

### Added
- `math-unicode` skill — auto-triggers on math; instructs Claude to emit math as Unicode glyphs (Greek, operators, relations, logic, sub/super) instead of raw LaTeX dollar-sign syntax.
- LaTeX → Unicode cheatsheet, style rules, common-forms reference, anti-patterns.
- `claude-math` CLI (`bin/claude-math.js`) — `install` / `uninstall` / `status` commands. Symlinks plugin into `~/.claude/plugins/local/` and patches `installed_plugins.json` + `settings.json`.
- npm distribution: `npx claude-math install`.
- Roadmap notes for opt-in graphical rendering (sixel / kitty graphics via a `claude-math-render` MCP server).
