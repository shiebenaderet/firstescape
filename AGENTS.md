# AGENTS.md

## Project overview

**Classroom Escape Hub** — a static, dependency-free web app for building collaborative
classroom escape-room games. Plain HTML + CSS + vanilla **ES modules**. No framework, no
package manager, no build step, no backend.

- Entry point: `index.html` → `src/main.js` (hash router: `#/` hub, `#/escape/<id>` runner, `#/results/<id>` teacher dashboard).
- Framework docs (how to author activities/escapes, activity types, results sinks): see `README.md`.
- The original single-file game is preserved at `legacy/original-game.html` for reference.

## Cursor Cloud specific instructions

### Running / testing (no build step)

- This is a **static site that uses ES modules**, so it must be served over HTTP. Opening
  `index.html` via `file://` will fail (module CORS). Serve the repo root and open the app:
  - `python3 -m http.server 8000` then open `http://localhost:8000/`.
  - Any static server works (`npx serve`, etc.).
- There is **no dependency install, no build, and no automated test suite**. "Linting" is just a
  syntax check: `node --check <file>` on the JS modules (e.g. `for f in $(find src -name '*.js'); do node --check "$f"; done`).

### Media clues (`assets/media/`)

- Activities may carry an optional `media` clue (video/audio) rendered with on-screen text +
  WebVTT captions. The files in `assets/media/` (`*.mp4`, `*.m4a`, `*.vtt`) are **ffmpeg-generated
  placeholders** standing in for the teacher's real recordings — replace them with real files of
  the same name/paths (or point `media.src`/`media.captions` at new files). `ffmpeg` is available
  in this environment if you need to regenerate placeholders.

### Results (replaces the old Google Form)

- Team results are captured by a pluggable sink system (`src/engine/results.js`). The default
  `local` sink saves completions to `localStorage` (keys prefixed `escape-hub:v1:`); the teacher
  views/exports them (CSV/JSON) at `#/results/<escapeId>`. Optional `webhook` and legacy
  `google-form` sinks exist for cloud collection. Because results live in `localStorage`, they are
  **per-browser/per-device** — testing in a fresh browser profile starts empty.

### Gotchas

- `geo-check` activities use the browser Geolocation API, which requires a secure context
  (`https://` or `http://localhost`) and user permission. A **teacher override** button is provided
  for indoor use / testing / devices without GPS.
- In-progress escape state also persists in `localStorage`; use the runner's **Restart** button (or
  clear storage) to replay from a clean state.
