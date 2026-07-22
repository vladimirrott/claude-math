# claude-math

Make math in Claude Code and Codex legible.

<p align="center">
  <img src="assets/demo.svg" alt="Without claude-math, LaTeX prints as raw dollar-sign noise; with it, the same answer renders as clean Unicode math." width="760">
</p>

Terminal coding agents do not render LaTeX. In both **Claude Code** and
**OpenAI Codex CLI**, a formula like `$f(x) = \sum_{i=1}^n x_i$` appears as raw
dollar signs and backslashes, exactly the noise you wanted formatting to
remove. This project ships a single skill (`math-unicode`) that instructs the
model to emit math as Unicode glyphs inline, which every terminal already
renders. It installs as a Claude Code plugin and, via the identical `SKILL.md`,
as a Codex skill (`claude-math install --codex`).

## Before / after

```
Before:  The qualifying cohort is $Q = \{ (s,r) \in T : n_{s,r} \geq 18 \wedge p^0_{s,r} < 0.9 \}$,
         with $|Q| / |T| \approx 17.3\%$.

After:   The qualifying cohort is Q = { (s,r) ∈ T : n_{s,r} ≥ 18 ∧ p⁰_{s,r} < 0.9 },
         with |Q| / |T| ≈ 17.3 %.
```

## Install

The quickest install is through the plugin marketplace (see below). The npm and manual paths also work.

### via npm

```bash
npm install -g claude-math
claude-math install
```

Symlinks the package into `~/.claude/plugins/local/claude-math`, registers it
in `installed_plugins.json`, and enables it in `settings.json` (atomically;
both files get a `.claude-math.bak` backup on first touch). Restart Claude
Code and the skill loads.

`npx claude-math install` also works: the CLI auto-detects an npx-cache
install path and **copies** rather than symlinks (since the cache directory
is ephemeral). Prefer the global install if you want updates via
`npm update -g claude-math` to propagate automatically.

Other commands:

```bash
claude-math status        # report target, validity, settings state, next-install mode
claude-math uninstall     # remove symlink/dir, deregister, disable
claude-math --help        # full flag list, env overrides
```

Flags: `--force` overrides safety checks (foreign symlinks, non-plugin
directories at the target). `--copy` forces a real copy instead of symlink.

### Manual install

```bash
git clone https://github.com/vladimirrott/claude-math \
  ~/.claude/plugins/local/claude-math
```

Then add `"claude-math@local": true` under `enabledPlugins` in
`~/.claude/settings.json` and a matching entry in
`~/.claude/plugins/installed_plugins.json`. The CLI does both; running it
once is the easiest path.

### Via Claude Code's plugin marketplace (recommended)

```
/plugin marketplace add vladimirrott/claude-math
/plugin install claude-math@vladimirrott
```

### Codex CLI

claude-math works in [OpenAI Codex CLI](https://developers.openai.com/codex/) too — the skill uses the same `name` + `description` `SKILL.md` frontmatter Codex reads. Two install paths:

**Native Codex plugin (recommended — no npm):**

```
codex plugin marketplace add vladimirrott/claude-math
codex plugin add claude-math@vladimirrott
```

Codex installs the plugin (manifest: `.codex-plugin/plugin.json`) and loads its `math-unicode` skill. Restart Codex if it does not appear; invoke with `/skills` or by mentioning `$math-unicode`. Remove with `codex plugin remove claude-math@vladimirrott`.

**Via npm (drops just the skill file):**

```bash
npm install -g claude-math
claude-math install --codex
```

This copies the skill into `~/.agents/skills/math-unicode/` (the current Codex user-skills dir; the older `~/.codex/skills/` path is deprecated but still read for backward compatibility). Use `claude-math status --codex` to check and `claude-math uninstall --codex` to remove. Set `CLAUDE_MATH_CODEX_SKILLS_DIR` to target a non-default skills directory.

Use one path or the other, not both — installing via the plugin *and* the CLI would load two copies of the same skill.

### Hacking on this repo

Working from a clone (before or after publish):

```bash
git clone https://github.com/vladimirrott/claude-math && cd claude-math
node bin/claude-math.js install     # uses the cloned directory directly
node --test test/                   # run the test suite
```

`CLAUDE_CONFIG_DIR=/tmp/somewhere claude-math install` lets you test against
a sandbox without touching your real `~/.claude` state, useful for
contributing.

The `math-unicode` skill auto-triggers any time the model (Claude or Codex)
writes or explains math. No configuration required.

## Graphical rendering (sixel / kitty): not inside the chat

Rendering math as an actual image (sixel or kitty graphics) is **not possible
inside the Claude Code chat**. The TUI repaints its own screen buffer on every
update and overwrites any graphics escape sequences a plugin emits, and its
line accounting does not know an image's height. So in-chat output stays
Unicode, which is the point of this skill.

Roadmap (not built yet): a standalone `claude-math render "<latex>"` command
that converts LaTeX to an image and prints it via the terminal's graphics
protocol in your own graphics-capable terminal (kitty, wezterm, ghostty,
foot), outside the Claude Code TUI. It would be a convenience for viewing an
equation on demand, not in-chat rendering.

## Why Unicode by default?

| Path | Works in plain terminal | SSH / tmux | CI logs | Copy-paste | Install cost |
|---|---|---|---|---|---|
| Unicode (this skill) | ✓ | ✓ | ✓ | ✓ | 1 file |
| Sixel / kitty graphics | ✗ (not in chat) | partial | ✗ | ✗ images | separate render CLI (roadmap) |
| Pipe through external viewer | ✗ TUI breaks | n/a | ✓ if `--print` | ✓ | shell wrapper |

Unicode is the only path that survives every distribution channel a Claude
Code session ends up in. The graphical path is roadmap-only and, even then,
would run as a separate terminal command outside the chat.

## Related issues & prior art

- [anthropics/claude-code#44479](https://github.com/anthropics/claude-code/issues/44479): native LaTeX in terminal output (open)
- [openai/codex#15865](https://github.com/openai/codex/issues/15865): LaTeX in Codex CLI output (claude-math covers this via `claude-math install --codex`)
- [warpdotdev/warp#9677](https://github.com/warpdotdev/warp/issues/9677): same gap on Warp
- [`markless`](https://github.com/jvanderberg/markless): terminal Markdown viewer with Typst math and kitty/sixel images
- [`mdviewer`](https://github.com/aquele-dinho/mdviewer), [`glowm`](https://github.com/atani/glowm), [`mdterm`](https://www.toolhunter.cc/tools/mdterm): adjacent viewers

## License

MIT.
