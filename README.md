# claude-math

Make math in Claude Code legible.

Claude Code's terminal does not render LaTeX. Without help, a formula like
`$f(x) = \sum_{i=1}^n x_i$` appears as raw dollar signs and backslashes —
exactly the noise you wanted formatting to remove. This plugin ships a single
skill (`math-unicode`) that instructs Claude to emit math as Unicode glyphs
inline, which every terminal already renders.

## Before / after

```
Before:  The qualifying cohort is $Q = \{ (s,r) \in T : n_{s,r} \geq 18 \wedge p^0_{s,r} < 0.9 \}$,
         with $|Q| / |T| \approx 17.3\%$.

After:   The qualifying cohort is Q = { (s,r) ∈ T : n_{s,r} ≥ 18 ∧ p⁰_{s,r} < 0.9 },
         with |Q| / |T| ≈ 17.3 %.
```

## Install

### via npm (recommended)

```bash
npm install -g claude-math
claude-math install
```

Symlinks the package into `~/.claude/plugins/local/claude-math`, registers it
in `installed_plugins.json`, and enables it in `settings.json` (atomically;
both files get a `.claude-math.bak` backup on first touch). Restart Claude
Code and the skill loads.

`npx claude-math install` also works — the CLI auto-detects an npx-cache
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
`~/.claude/plugins/installed_plugins.json`. The CLI does both — running it
once is the easiest path.

### Via Claude Code's plugin marketplace

```
/plugin marketplace add vladimirrott/claude-math
/plugin install claude-math@vladimirrott
```

### Hacking on this repo

Working from a clone (before or after publish):

```bash
git clone https://github.com/vladimirrott/claude-math && cd claude-math
node bin/claude-math.js install     # uses the cloned directory directly
node --test test/                   # run the test suite
```

`CLAUDE_CONFIG_DIR=/tmp/somewhere claude-math install` lets you test against
a sandbox without touching your real `~/.claude` state — useful for
contributing.

The `math-unicode` skill auto-triggers any time Claude writes or explains math.
No configuration required.

## Opt-in: graphical rendering (sixel / kitty graphics)

For users on terminals that support graphics protocols — **kitty, wezterm,
ghostty, foot, mlterm** — a companion sidecar can render `$…$` and `$$…$$`
as inline KaTeX images. Roadmap:

- **`claude-math-render`** — an MCP server exposing a `render_math(latex, display)`
  tool. Claude calls it with raw LaTeX; the server pipes through headless
  KaTeX → PNG → emits via the terminal's graphics protocol (kitty graphics
  protocol or sixel) so the image appears inline with text output.
- Capability detection at session start (a `SessionStart` hook reads `$TERM`
  and the kitty graphics protocol query response) selects which skill is
  active: `math-unicode` (default) or `math-latex-passthrough` (graphical
  terminals — emit raw LaTeX, the MCP renders it).
- For non-interactive use, pipe `claude --print "…" | markless` ([markless](https://github.com/jvanderberg/markless)
  renders LaTeX via Typst with sixel/kitty/iTerm2 image fallback).

Status: design only. Contributions welcome — see [`docs/render-architecture.md`](docs/render-architecture.md) (TODO).

## Why Unicode by default?

| Path | Works in plain terminal | SSH / tmux | CI logs | Copy-paste | Install cost |
|---|---|---|---|---|---|
| Unicode (this skill) | ✓ | ✓ | ✓ | ✓ | 1 file |
| Sixel / kitty graphics | ✗ | partial | ✗ | ✗ images | MCP + daemon + Node + KaTeX |
| Pipe through external viewer | ✗ TUI breaks | n/a | ✓ if `--print` | ✓ | shell wrapper |

Unicode is the only path that survives every distribution channel a Claude
Code session ends up in. The graphical extension is opt-in because it requires
trade-offs the average user shouldn't have to think about.

## Related issues & prior art

- [anthropics/claude-code#44479](https://github.com/anthropics/claude-code/issues/44479) — native LaTeX in terminal output (open)
- [openai/codex#15865](https://github.com/openai/codex/issues/15865) — same gap on Codex CLI (Unicode-only today)
- [warpdotdev/warp#9677](https://github.com/warpdotdev/warp/issues/9677) — same gap on Warp
- [`markless`](https://github.com/jvanderberg/markless) — terminal MD viewer with Typst math + kitty/sixel images
- [`mdviewer`](https://github.com/aquele-dinho/mdviewer), [`glowm`](https://github.com/atani/glowm), [`mdterm`](https://www.toolhunter.cc/tools/mdterm) — adjacent viewers

## License

MIT.
