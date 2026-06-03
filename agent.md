# Agent Guide for typing-app

## Project Snapshot

`typing-app` is a single-page English typing practice app built with React 19, TypeScript, Vite 8, Tailwind CSS v4, Recharts, and Tone.js. The UI is a retro typewriter practice surface with a home screen, multiple test modes, custom text import, IELTS Task 2 practice essays, keyboard highlighting, typing audio, and a final stats report.

Production is deployed through GitHub Pages at:

`https://zack123chen.github.io/typing-app/`

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs `npm ci`, `npm run build`, uploads `dist`, and deploys with GitHub Pages.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

Notes:

- Node.js 22 or newer is expected.
- `npm run dev` starts Vite on `http://localhost:5173`.
- `npm run build` runs `tsc -b && vite build`.
- There is no test runner configured.
- `vite.config.ts` uses `base: '/typing-app/'`; keep this for the current GitHub Pages repo name.

## File Map

- `src/main.tsx`: React entrypoint. Imports `src/index.css` and renders `TypingApp` inside `StrictMode`.
- `src/App.tsx`: Main application. Most state, event handling, text generation, timer logic, audio setup, and UI components live here.
- `src/ielts.ts`: Static IELTS Task 2 essay data. Exports `IELTS_ESSAYS`.
- `src/index.css`: Tailwind import plus app-level animation classes and reduced-motion handling.
- `vite.config.ts`: Vite React + Tailwind plugin config and GitHub Pages base path.
- `eslint.config.js`: ESLint flat config with TypeScript, React Hooks, and React Refresh rules.
- `.github/workflows/deploy.yml`: GitHub Pages deployment workflow.
- `README.md`: User-facing project summary and usage instructions.
- `CLAUDE.md`: Existing agent-oriented project notes. Some architecture details may lag behind the current app because the app has grown beyond the older words/quotes/custom-only model.

## Current Architecture

The app intentionally keeps state centralized in `TypingApp`. Avoid introducing global state unless the component becomes genuinely hard to reason about.

Primary state groups in `src/App.tsx`:

- View state: `view` is `"home"` or `"test"`.
- Test configuration: `testType`, `timeOpt`, `wordOpt`, `punct`, `nums`, `source`, `ieltsIndex`.
- Typing run state: `target`, `typed`, `status`, `totalTime`, `timeLeft`, `wpmHistory`.
- UI state: `showKeyboard`, `showCustom`, `draft`, `fileName`, `offset`, `soundOn`.
- Runtime refs: `typedRef`, `targetRef`, `totalTimeRef`, `soundOnRef`, `caretRef`, `prevOffsetRef`, `audioRef`.

The status state machine is:

```text
waiting -> running -> finished
```

Key transitions:

- First printable key starts the run and appends to `typed`.
- `Backspace` removes the last typed character.
- `Tab` restarts during a test.
- `Enter` restarts from the finished report.
- Non-time modes finish when `typed.length >= target.length`.
- Time mode finishes when the timer reaches zero and extends generated text before the user runs out.

## Test Modes

`TestType` currently supports:

- `time`: Fixed duration from `TIME_OPTS` (`15`, `30`, `60`, `120`). Target words extend dynamically while running.
- `words`: Fixed word count from `WORD_OPTS` (`10`, `25`, `50`, `100`).
- `quotes`: Randomly shuffles and joins three built-in quotes.
- `ielts`: Uses one essay from `IELTS_ESSAYS`, with question shown above the typing area.
- `custom`: Uses user-pasted or uploaded `.txt` / `.md` text after whitespace normalization and truncation to `MAX_LEN`.

Text generation flows through:

- `genWordList`
- `genQuotes`
- `clean`
- `genTarget`
- `durationFor`
- `restart`

`restart(overrides)` is the main reset-and-reconfigure function. Prefer using it when changing mode options so state stays consistent.

## Metrics

WPM is calculated from correct characters:

```text
(correctChars / 5) / elapsedMinutes
```

Raw WPM uses all typed characters:

```text
(typed.length / 5) / elapsedMinutes
```

The final report shows WPM, accuracy, raw WPM, consistency, correct chars, incorrect chars, elapsed time, and a Recharts line chart.

## UI and Styling

Styling is split between Tailwind utility classes and the palette object `C` in `src/App.tsx`.

Important visual conventions:

- Keep the retro typewriter theme: dark desk, cream paper, muted ring borders, red accents.
- Prefer squared or very small-radius controls (`borderRadius: 2`) to match the existing mechanical look.
- `LINE_H = 46` must stay aligned with the rendered typing line-height, because caret offset drives paper scrolling and bell timing.
- `src/index.css` defines view, section, paper, and result animations with a `prefers-reduced-motion` fallback.

## Audio

Tone.js is lazy-initialized in `initAudio()` on user interaction because browsers block autoplay.

Current sounds:

- White noise and membrane synth for key clicks.
- Higher sine synth bell for line wrap, timeout, and completion.
- Tone errors are swallowed so audio failures do not break typing.

## Security Notes

This app has no backend, auth, database, or network fetches. Main risk surfaces are local file import and text rendering.

Keep these rules:

- Do not render custom text with `innerHTML`.
- Continue rendering typed/target text as React text children so React escapes user-provided content.
- Keep custom file reading client-side only.
- Preserve `MAX_LEN` or another clear bound for pasted/uploaded text.
- Do not commit `.env*`, local secrets, `dist`, `node_modules`, or editor/system files.

## Verification Before Push

Run:

```bash
npm run lint
npm run build
```

As of the latest local check:

- `npm run build` passes.
- `npm run lint` passes.

Recent lint fixes to preserve:

- Ref synchronization belongs in an effect, not during render.
- Audio handlers should use explicit `if` statements instead of short-circuit expressions for Tone calls.
- Empty audio `catch` blocks should include a short explanatory comment.
- Completion and time-mode target extension happen from keyboard handling rather than synchronous state updates inside effects.

Also run a lightweight secret scan before commit/push, especially when adding docs or config:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!package-lock.json' --glob '!.git/**' -i '(api[_-]?key|secret|token|password|passwd|private[_-]?key|BEGIN (RSA|OPENSSH|EC|DSA)? ?PRIVATE KEY|github_pat|ghp_|sk-[A-Za-z0-9]|AKIA[0-9A-Z]{16})' .
```

Expected benign hits may include GitHub Actions `id-token: write` and SVG text; inspect results manually.

## Git / Deployment Workflow

Before pushing:

```bash
git status --short --branch
git diff --stat
git diff
npm run lint
npm run build
```

Then stage intentional files only. Current remote is:

```text
origin git@github.com:Zack123Chen/typing-app.git
```

The active branch is expected to be `main`, tracking `origin/main`.

## Editing Guidance

- Keep changes focused; this repo is compact and easy to accidentally over-expand.
- Prefer improving helpers inside `App.tsx` before adding new files, unless the data or component clearly deserves separation.
- If adding more IELTS prompts or static practice libraries, place structured data in `src/ielts.ts` or a new sibling data module.
- If adding persistence, use localStorage carefully and validate parsed values.
- If adding routes or backend behavior, update this file, `README.md`, deployment notes, and security notes.
