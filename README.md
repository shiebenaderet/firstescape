# Classroom Escape Hub

A small, dependency-free framework for building collaborative **classroom escape-room games**.
Students work in teams to solve puzzles, riddles, and challenges to "escape the room."

The hub is a growing catalog: define reusable **activities** once, then **mix and match** them into
**escapes** of any length. New escapes can be added throughout the year without touching the engine.

- **No build step, no dependencies** — plain HTML + CSS + ES modules.
- **Extensible** — add a new puzzle type by dropping in one file.
- **Reusable** — a shared activity bank feeds many escapes.
- **Resumable** — progress is saved per escape in the browser (teams can refresh without losing work).
- **Optional data capture** — each escape can post results to a Google Form/Sheet.

## Run it locally

Because the app uses ES modules, serve it over HTTP (opening the file via `file://` will not work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Any static server works (`npx serve`, etc.). For hosting, any static host (e.g. GitHub Pages) works.

## Project structure

```
index.html                     App shell (loads the module app)
src/
  main.js                      Hash router + boot (#/ hub, #/escape/<id> runner)
  styles.css                   All styling
  engine/
    engine.js                  Core play loop: state, progression, timer, hints, victory
    storage.js                 Per-escape progress persistence (localStorage)
    submission.js              Optional results submission (e.g. Google Form)
    dom.js                     Tiny DOM helpers
  activities/                  Reusable PUZZLE TYPES (the extensible part)
    index.js                   Activity-type registry
    teamSetup.js, multipleChoice.js, textAnswer.js,
    teamResponses.js, computedLock.js, constructedAnswer.js
  content/
    bank.js                    Reusable activity instances (riddles, etc.)
    index.js                   Escape + bank registry
    escapes/                   ESCAPE definitions (compositions of activities)
      gettingToKnowYou.js
      quickMixer.js
  views/
    hub.js, victory.js         Catalog + celebration screens
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

| Type | Use for |
| --- | --- |
| `team-setup` | Class period + team roster (name + favorite subject). Populates shared team state. |
| `multiple-choice` | Riddles/questions with selectable options and correct answer(s). |
| `text-answer` | Free-text riddles / "search for information" clues (accepts one or more answers). |
| `team-responses` | One open-ended response per team member. |
| `computed-lock` | Multi-step lock whose answers are computed from earlier answers/roster. |
| `constructed-answer` | Free writing validated against custom checks (mottos, cheers, exit tickets). |

## Design & accessibility

The UI uses a warm, friendly "classroom" theme built entirely from CSS variables in
`src/styles.css` (`:root` tokens), so palettes — and future per-escape themes — are easy to swap.

- **Self-hosted fonts** (`assets/fonts/`, `assets/fonts.css`): [Atkinson Hyperlegible](https://brailleinstitute.org/freefont)
  (an accessibility-focused body font) + Fredoka (friendly rounded headings). Served locally, so
  there are no third-party requests from students' browsers and it works offline.
- **Bigger-text toggle** in the hub header (persisted via `src/engine/prefs.js`) scales the whole app.
- Visible keyboard focus rings, a "Skip to content" link, `prefers-reduced-motion` support, ARIA
  labels on the lock dials and sound pads, and captioned media clues.

## Results submission (optional)

An escape may include a `submission` config to record team results, e.g.:

```js
submission: {
  type: 'google-form',
  action: 'https://docs.google.com/forms/d/e/XXXX/formResponse',
  buildFields: (state, meta) => ({ 'entry.123': state.team.period, 'entry.456': meta.completionTime }),
}
```

Submission uses a hidden iframe and never blocks gameplay if it fails.
