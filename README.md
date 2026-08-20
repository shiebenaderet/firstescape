# Classroom Escape Hub

A small, dependency-free framework for building collaborative **classroom escape-room games**.
Students work in teams to solve puzzles, riddles, and challenges to "escape the room."

The hub is a growing catalog: define reusable **activities** once, then **mix and match** them into
**escapes** of any length. New escapes can be added throughout the year without touching the engine.

- **No build step, no dependencies** — plain HTML + CSS + ES modules.
- **Extensible** — add a new puzzle type by dropping in one file.
- **Reusable** — a shared activity bank feeds many escapes.
- **Resumable** — progress is saved per escape in the browser (teams can refresh without losing work).
- **Teacher dashboard** — build escapes visually, toggle which rooms students see, and review
  every class's results in one place (needs the optional backend).

Two pieces:

| | |
| --- | --- |
| **Frontend** (this repo root) | Static site. Runs on its own; hosted on GitHub Pages. |
| **Backend** (`server/`) | Cloudflare Worker + D1. Teacher login, central results, custom escapes. Optional — see `server/README.md`. |

Set `API_BASE = ''` in `src/config.js` to run fully offline: built-in escapes only, results saved
locally, no dashboard.

## Run it locally

Because the app uses ES modules, serve it over HTTP (opening the file via `file://` will not work):

```bash
npm run serve          # or: python3 -m http.server 8000
# then open http://localhost:8000/
```

Any static server works (`npx serve`, etc.). For hosting, any static host (e.g. GitHub Pages) works.

To work on the API too, see `server/README.md` (`npm run dev` in `server/`).

## Tests

```bash
npm test        # Node's built-in runner, no dependencies
npm run check   # syntax check every JS file
```

`npm test` covers the pure logic (answer matching, CSV export, record building, results parsing),
verifies every module actually imports, checks that builder schemas stay JSON-safe, and guards
against the `hidden`/`display` CSS trap documented in `AGENTS.md`.

## Project structure

```
index.html                     App shell (loads the module app)
src/
  main.js                      Hash router + boot (#/ hub, #/escape/<id>, #/results/<id>, #/teacher)
  config.js                    API_BASE — the Worker URL ('' disables the backend)
  styles.css                   All styling (theme tokens in :root)
  engine/
    engine.js                  Core play loop: state, progression, timer, hints, victory
    storage.js                 Per-escape progress persistence (localStorage)
    results.js                 Pluggable results sinks + CSV/record helpers
    apiClient.js               Worker API client + teacher session token
    prefs.js                   Bigger-text preference
    dom.js                     Tiny DOM helpers
  activities/                  Reusable PUZZLE TYPES (the extensible part)
    index.js                   Activity-type registry
    schemas.js                 Builder form definitions (which types teachers can author)
    answerMatch.js             Shared answer normalization for free-text types
    broken.js                  Skippable placeholder for unresolvable challenges
    teamSetup.js, multipleChoice.js, textAnswer.js, teamResponses.js,
    computedLock.js, constructedAnswer.js, cipher.js, combinationLock.js,
    sequence.js, hiddenClue.js, geoCheck.js
  content/
    bank.js                    Reusable activity instances (riddles, etc.)
    index.js                   Escape + bank registry (merges custom escapes from the API)
    escapes/                   ESCAPE definitions (compositions of activities)
      gettingToKnowYou.js, cipherLab.js, quickMixer.js
  views/
    hub.js, victory.js         Catalog + celebration screens
    media.js                   Optional video/audio clue player
    results.js                 Per-device results view
    teacher/                   Dashboard: login, central results, visual escape builder
server/                        Cloudflare Worker + D1 (see server/README.md)
test/                          Node test-runner suite (npm test)
legacy/
  original-game.html           The original single-file game, kept for reference
```

## Core concepts

- **Activity type** — a category of puzzle with a renderer + validator (e.g. `multiple-choice`).
  Adding a type makes a new kind of interaction available to every escape.
- **Activity** — a concrete puzzle: a `type` plus `config` (prompt, options, checks, …), an `id`,
  and optional `story`, `hints`, and `bonus`.
- **Bank** — reusable activities referenced by id, so escapes can share content.
- **Escape** — metadata (title, icon, estimated minutes, tags) plus an ordered `activities` list.
  Entries can be a bank id (string) or an inline activity object — mix and match freely.
  - `intro` — optional scene-setting text, shown until the team solves the first puzzle.
  - `structure` — `'linear'` (default; one challenge at a time) or `'non-linear'` (all puzzles
    on one board, solvable in any order).

An entry that cannot be resolved — an unknown bank id, an unknown activity type, a malformed
object — renders a skippable "could not be loaded" card rather than throwing, so a single typo
never blanks the room in the middle of class.

## Add a new escape

Create `src/content/escapes/myEscape.js`:

```js
export const myEscape = {
  id: 'my-escape',
  title: 'My New Escape',
  icon: '🧭',
  estimatedMinutes: 15,
  tags: ['puzzles'],
  summary: 'A short description shown on the hub card.',
  activities: [
    'riddle-keyboard',           // reuse from the bank
    {                            // or define inline
      id: 'my-riddle',
      type: 'text-answer',
      title: 'A Riddle',
      config: { prompt: 'What has to be broken before you can use it?', accept: ['egg', 'an egg'] },
    },
  ],
  victory: { title: 'You escaped!', accomplishments: ['Solved every puzzle'] },
};
```

Then register it in `src/content/index.js` (import it and add to `ESCAPES`).

## Add a new activity type

Create `src/activities/myType.js`:

```js
export default {
  type: 'my-type',
  label: 'My puzzle type',
  mount(host, api) {
    // Render your UI into `host`, then when solved:
    //   api.error('message')        show an error
    //   api.success('message')      show a success message
    //   api.setAnswer(value)        store this activity's answer
    //   api.patchState({ ... })     merge into shared team state
    //   api.getState()              read shared state (state.team, state.answers)
    //   api.solve()                 mark solved and advance
  },
};
```

Register it in `src/activities/index.js`. Any escape can now use `type: 'my-type'`.

## Built-in activity types

"In builder" marks types teachers can author from the dashboard without code.

| Type | Use for | In builder |
| --- | --- | --- |
| `team-setup` | Class period + team roster (name + favorite subject). Populates shared team state. | ✅ |
| `multiple-choice` | Riddles/questions with selectable options and correct answer(s). | ✅ |
| `text-answer` | Free-text riddles / "search for information" clues (accepts one or more answers). | ✅ |
| `team-responses` | One open-ended response per team member. | ✅ |
| `constructed-answer` | Free writing validated against custom checks (mottos, cheers, exit tickets). | ✅ |
| `cipher` | An encoded word the team decodes (Caesar, Atbash, or symbols). | ✅ |
| `combination-lock` | Dials rolled to a secret number combination. | ✅ |
| `hidden-clue` | A code the teacher hid physically in the room. | ✅ |
| `sequence` | Pads pressed in order — a musical or pattern lock. | ✅ |
| `geo-check` | Team walks to a real GPS location (has a teacher override). | ✅ |
| `computed-lock` | Multi-step lock whose answers are computed from earlier answers/roster. | ❌ see below |
| `broken` | Internal: skippable placeholder for a challenge that could not be resolved. | — |

**Why `computed-lock` is not in the builder:** its config holds JavaScript functions
(`compute: (state) => …`). Dashboard-authored escapes are stored as JSON in D1, and
`JSON.stringify` silently drops functions — a teacher-built one would save cleanly and then
crash students at play time. Use it in code-defined escapes only. Exposing it would first
require a declarative, JSON-safe formula format.

## Design & accessibility

The UI uses a warm, friendly "classroom" theme built entirely from CSS variables in
`src/styles.css` (`:root` tokens), so palettes — and future per-escape themes — are easy to swap.

- **Self-hosted fonts** (`assets/fonts/`, `assets/fonts.css`): [Atkinson Hyperlegible](https://brailleinstitute.org/freefont)
  (an accessibility-focused body font) + Fredoka (friendly rounded headings). Served locally, so
  there are no third-party requests from students' browsers and it works offline.
- **Bigger-text toggle** in the hub header (persisted via `src/engine/prefs.js`) scales the whole app.
- Visible keyboard focus rings, a "Skip to content" link, `prefers-reduced-motion` support, ARIA
  labels on the lock dials and sound pads, and captioned media clues.

## Results

When a team finishes, the engine builds a **record** (period, roster, completion time, and every
per-activity answer as `answer:<activityId>` columns) and hands it to one or more **sinks**:

| Sink | What it does |
| --- | --- |
| `local` | Saves to this browser's `localStorage`. View per-device at `#/results/<escapeId>`. Default. |
| `api` | POSTs to the Worker so results from **every device** land in D1. Runs automatically whenever `API_BASE` is set. |
| `webhook` | Fire-and-forget POST to a URL you control. |
| `google-form` | Legacy: posts to a Google Form via a hidden iframe. |

The **teacher dashboard** (`#/teacher` → Results) is the real view: it reads centrally from D1,
shows summary tiles, expands each row to reveal what the team wrote, and exports CSV/JSON
including those answer columns.

Sinks are fire-and-forget — a failed submission never blocks gameplay or the victory screen.

Per-escape overrides (all optional):

```js
results: {
  sinks: ['local'],                        // which sinks run on completion
  central: false,                          // opt out of the automatic `api` sink
  buildRecord: (state, meta) => ({ … }),   // custom columns
  webhook: { url: 'https://…' },
}
```
