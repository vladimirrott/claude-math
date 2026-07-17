# Changelog

All notable changes to `claude-math` documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [0.2.0](https://github.com/vladimirrott/claude-math/compare/v0.1.0...v0.2.0) (2026-07-17)


### Features

* **cli:** add --codex install target (drops math-unicode into Codex skills dir) ([#3](https://github.com/vladimirrott/claude-math/issues/3)) ([738a831](https://github.com/vladimirrott/claude-math/commit/738a8312f8c3febd83588657377e8013946400c9))

## [0.1.0] — 2026-05-20

### Added
- `math-unicode` skill — auto-triggers on math; instructs Claude to emit math as Unicode glyphs (Greek, operators, relations, logic, sub/super) instead of raw LaTeX dollar-sign syntax.
- LaTeX → Unicode cheatsheet, style rules, common-forms reference, anti-patterns.
- `claude-math` CLI (`bin/claude-math.js`) — `install` / `uninstall` / `status` / `prepack` commands. Symlinks plugin into `~/.claude/plugins/local/` and patches `installed_plugins.json` + `settings.json`.
- **Install safety**: atomic JSON writes (`.tmp` + rename); `.claude-math.bak` backup of `settings.json` and `installed_plugins.json` on first touch; refuses to overwrite a foreign symlink or non-plugin directory without `--force`.
- **Install modes**: auto-copy when invoked from an npx cache path (ephemeral location); junction on Windows; symlink elsewhere. `--copy` flag forces copy.
- **Tests**: `node --test` suite covering install/uninstall round-trip, idempotency, atomicity, backups, copy mode, foreign-symlink refusal, and prepack version sync.
- **CI**: `.github/workflows/ci.yml` (matrix: ubuntu/macos × node 18/20/22) and `.github/workflows/publish.yml` (tag-triggered `npm publish --provenance`).
- `prepack` script auto-syncs `.claude-plugin/plugin.json` version from `package.json` so the two never drift.
- Roadmap notes for opt-in graphical rendering (sixel / kitty graphics via a `claude-math-render` MCP server).
