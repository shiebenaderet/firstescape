# AGENTS.md

## Project overview

**Classroom Escape Hub** — a static, dependency-free web app for building collaborative
classroom escape-room games. Plain HTML + CSS + vanilla **ES modules**. No framework, no
bundler, no build step on the frontend.

There **is** a backend: a small Cloudflare Worker in `server/` with D1 (results, custom escapes,
settings) and R2 (teacher clue recordings), providing teacher login, central results collection,
custom escapes authored in the dashboard, hub visibility, and media uploads. The frontend still runs standalone — set `API_BASE = ''` in `src/config.js` and it
degrades to built-in escapes with local-only results.

- Entry point: `index.html` → `src/main.js` (hash router: `#/` hub, `#/escape/<id>` runner,
  `#/results/<id>` per-device results, `#/teacher` teacher dashboard).
- Framework docs (how to author activities/escapes, activity types, results sinks): see `README.md`.
- Worker API and deployment: see `server/README.md`.
- The original single-file game is preserved at `legacy/original-game.html` for reference.

## Cursor Cloud specific instructions

### Running / testing (no build step)

- This is a **static site that uses ES modules**, so it must be served over HTTP. Opening
  `index.html` via `file://` will fail (module CORS). Serve the repo root and open the app:
  - `npm run serve` (or `python3 -m http.server 8000`) then open `http://localhost:8000/`.
  - Any static server works (`npx serve`, etc.).
- There is **no dependency install and no build step** for the frontend.
- **Tests:** `npm test` runs Node's built-in test runner over `test/` — no dependencies. It
  covers pure logic (answer matching, CSV, record building, results parsing), an
  import-resolution smoke test, and a CSS guard (see below). Run it before pushing.
- **Syntax check:** `npm run check` runs `node --check` over every JS file. Note this parses
  files in isolation — it cannot catch a bad import or a missing export, which is what the
  import smoke test in `test/modules.test.js` is for.

### The `hidden` + `display` trap (has bitten this project twice)

The `hidden` attribute works only because the UA stylesheet sets `[hidden] { display: none }`.
**Any** author rule that sets `display` on the same element overrides it, so the element stays
visible while the JS correctly believes it is hidden. This produced a stuck-open emoji picker
and a "✓ Solved" badge on unsolved puzzles.

When you give a class both a `display` rule and JS that toggles `hidden`, add an explicit
`.thing[hidden] { display: none; }`. `test/styles.test.js` enforces this and will fail the
build if you forget.

### Media clues (`assets/media/`)

- Activities may carry an optional `media` clue (video/audio) rendered with on-screen text +
  WebVTT captions. The files in `assets/media/` (`*.mp4`, `*.m4a`, `*.vtt`) are **ffmpeg-generated
  placeholders** standing in for the teacher's real recordings — replace them with real files of
  the same name/paths (or point `media.src`/`media.captions` at new files). `ffmpeg` is available
  in this environment if you need to regenerate placeholders.
- The two bank activities using placeholders carry `media.placeholder: true`, which renders a
  visible "Sample clip" note so students aren't left pressing play on silence. **Delete that
  flag when the real recording is dropped in** (search for `TODO(teacher)` in `src/content/bank.js`).
- The riddle text is always rendered alongside the player, so a clue that cannot be played never
  blocks a team from solving the puzzle.
- **`media.src` may be a repo-relative path (built-ins) or an absolute R2 URL** (dashboard
  recordings). `renderMedia()` treats it as an opaque URL, so both work identically — do not add
  path handling.
- **`media.text` is mandatory whenever `media.src` is set.** The builder blocks saving without it
  (`save()` in `src/views/teacher/builder.js`) and `test/mediaGuard.test.js` pins the rule,
  including a check that the built-in bank complies.
- Teacher recordings are captured by `src/views/teacher/recorder.js` and uploaded via
  `POST /api/admin/media`. Transitions live in `recorderState.js` as a pure reducer so they are
  testable without a browser — put new recorder logic there, not in the DOM code.

### Results (replaces the old Google Form)

- Team results are captured by a pluggable sink system (`src/engine/results.js`). The `local`
  sink saves completions to `localStorage` (keys prefixed `escape-hub:v1:`), viewable per-device
  at `#/results/<escapeId>`. Whenever `API_BASE` is set, the `api` sink **also** runs by default
  (unless an escape sets `results.central: false`), posting to the Worker so every device's
  results land in D1.
- **The real teacher view is `#/teacher` → Results**, which reads centrally from D1. Rows expand
  to show each team's written answers, and CSV/JSON exports include those answer columns.
- Legacy `webhook` and `google-form` sinks still exist for backward compatibility.

### Gotchas

- **Custom escapes must be JSON-serializable.** Dashboard-authored escapes round-trip through
  `JSON.stringify` into D1, which silently drops functions. This is why `computed-lock` is
  implemented and playable but **deliberately absent from the builder palette**
  (`src/activities/schemas.js`): its config holds `compute: (state) => …` callbacks that would
  vanish on save and crash students at play time. Code-defined escapes may use functions freely;
  anything reachable from the builder may not. `test/modules.test.js` enforces this on schema
  defaults.
- Unresolvable challenges (unknown bank id, unknown activity type, malformed entry) render the
  `broken` placeholder — a skippable card — instead of throwing and blanking the room mid-class.
- `geo-check` accepts either a nested `target: { lat, lng }` (code-defined) or flat `lat`/`lng`
  (what the builder writes). It warns rather than failing silently when no coordinates are set.
- `geo-check` activities use the browser Geolocation API, which requires a secure context
  (`https://` or `http://localhost`) and user permission. A **teacher override** button is provided
  for indoor use / testing / devices without GPS.
- In-progress escape state also persists in `localStorage`; use the runner's **Restart** button (or
  clear storage) to replay from a clean state.
