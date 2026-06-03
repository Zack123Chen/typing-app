# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # tsc -b && vite build, output in dist/
npm run lint     # ESLint flat config (eslint.config.js)
npm run preview  # Preview the production build
```

Requires Node.js ≥ 22. There is no test runner configured.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages. `vite.config.ts` has `base: '/typing-app/'` — if forking, change this to `/<repo-name>/`.

## Architecture

Single-page React 19 + TypeScript + Vite app. The entire application lives in `src/App.tsx` (~460 lines) as one `TypingApp` component. There are no routes, no global state library, no backend, and no persistence.

Things to know before editing `App.tsx`:

- **State is intentionally centralized.** All state (mode, target text, typed string, status, timers, WPM history, audio refs, custom-text drafts) is co-located in `TypingApp`. Mirror refs (`typedRef`, `targetRef`, `totalTimeRef`, `soundOnRef`) exist because event listeners and intervals close over stale values — keep them in sync on every render.
- **Status state machine**: `"waiting" → "running" → "finished"`. Transitions live in the `keydown` effect (first keypress starts running), the interval effect (timeout → finished), and the typed-vs-target effect (completion → finished). `Tab` / `Enter`-on-finished call `restart()`.
- **Text generation** has three sources, selected via `mode` (`"words" | "quotes"`) and `source` (custom text override). `genWords()` samples from `WORDS`, `genQuotes()` shuffles `QUOTES`. Custom text comes from a textarea or a `.txt`/`.md` upload, passed through `clean()` (whitespace-normalized, capped at `MAX_LEN = 2000`).
- **Time limit** is dynamic: `calcTime(text)` returns `clamp(ceil(len/CPM*60), 30, 300)` seconds, where `CPM = 200`.
- **WPM** is `(correctChars / 5) / (elapsedMinutes)`, sampled every second into `wpmHistory` and rendered with recharts at the end.
- **Audio (Tone.js)** is lazy-initialized on the first keypress (`initAudio`) because browsers block audio before a user gesture. `click()` plays a white-noise + membrane thock (pitched lower on wrong keys); `ding()` is the carriage bell, triggered on line wrap, timeout, and completion. Errors from Tone are intentionally swallowed.
- **Line-wrap detection** uses `caretRef.offsetTop` to compute a `translateY` offset on the paper area; when the offset increases, a bell rings. `LINE_H = 46` must match the line-height in the rendered paper.
- **Keyboard visual** is data-driven from `KEYBOARD` (rows) and `FINGER` (per-key color, indexed by lowercase letter). The next expected key is highlighted by reading `target[typed.length]`.

## Conventions

- Tailwind v4 via `@tailwindcss/vite` — there is no `tailwind.config.*`; styling is utility classes + a palette object `C` inside `App.tsx` for the typewriter colors.
- Recharts and Tone.js are heavy; if you add features, prefer keeping them dynamically importable rather than introducing more top-level deps.
- TypeScript is strict (see `tsconfig.app.json`). `FINGER` has an explicit index signature because it's keyed by `e.key`.
