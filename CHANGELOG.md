# Changelog

All notable changes to the Classroom Escape Hub.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/): the **frontend and Worker share a
version**, since an escape definition written by one is read by the other.

## [1.1.0] — 2026-08-20

### Added

- **Teacher clue recordings.** Record a video or audio riddle directly in the dashboard
  (camera or microphone), preview it, retake, and attach it to a challenge. Recordings upload
  to Cloudflare R2 and are served to students from `media.mrbsocialstudies.org`. Teachers who
  recorded elsewhere can upload a file instead, and browsers without `MediaRecorder` fall back
  to the file picker automatically.
  - New endpoint `POST /api/admin/media` (Bearer auth, 40 MB cap, 5 uploads/min).
  - The riddle text is **required** whenever a challenge has a recording — saving is blocked
    otherwise, so a clip is never the only way to solve a puzzle.
- **Rate limiting** on the public API: `POST /api/results` (10/min) and `POST /api/login`
  (5/min) per IP. Login previously had no brute-force protection and `/api/results` accepted
  unlimited anonymous writes to the database.
- **Expandable results.** Each row in the teacher dashboard now expands to show what the team
  wrote, and CSV/JSON exports include those answer columns. This data was already being
  collected and stored, but never surfaced.
- **Two more builder challenge types:** `sequence` (sound/pattern lock) and `geo-check`
  (walk to a GPS location). The palette went from 8 types to 10.
- **Escape intro text** now renders. It was editable in the builder but never shown to
  students; it now appears until the team solves the first puzzle.
- **Linear / non-linear** is selectable in the builder. The engine already supported
  non-linear escapes, but nothing could author one.
- **Test suite** — 68 tests via Node's built-in runner, no dependencies. Covers answer
  matching, CSV export, results parsing, media validation, the recorder state machine, module
  imports, and a CSS guard (see below).
- Local development now targets a local Worker automatically when the site is served from
  `localhost`, so development never writes into the production database.

### Fixed

- **The emoji picker stayed open after choosing an icon.** `.emoji-grid` set `display: grid`,
  which overrides the `hidden` attribute's browser default — the JavaScript was correct all
  along, but CSS kept painting the popup.
- **"✓ Solved" appeared on unsolved puzzles.** The same `hidden`/`display` conflict on
  `.solved-badge`, found by auditing the stylesheet after the emoji-picker bug. Teams could be
  told they had finished a challenge they had not started.
- **Correct answers were rejected.** Answer normalization replaced apostrophes with a space,
  so `"Don't"` became `don t` and a team typing `dont` was marked wrong; likewise `T.V.` vs
  `tv`. Curly apostrophes (U+2019, which tablets substitute automatically) now match straight
  ones, so grading no longer depends on the student's device. Three duplicate copies of this
  logic were consolidated into `src/activities/answerMatch.js`.
- **A bad activity id crashed the whole room.** An unknown bank id threw and blanked the
  screen; unresolvable challenges now render a skippable placeholder so one typo cannot strand
  a class mid-period.
- `geo-check` accepts flat `lat`/`lng` (what the builder writes) as well as a nested `target`,
  and warns instead of failing silently when no coordinates are set.
- `sequence` no longer auto-solves when no answer has been authored.

### Documentation

- `README.md` and `AGENTS.md` corrected: they claimed the project had "no backend" and
  documented Google Forms as the primary results path. Both predate the Worker and dashboard.
- Design spec and implementation plan for the recording flow added under `docs/superpowers/`.
- Documented why `computed-lock` is deliberately absent from the builder: its config holds
  JavaScript functions, which `JSON.stringify` drops when a custom escape is saved to D1. A
  teacher-authored one would save cleanly and then crash at play time. A test now enforces
  that every builder schema stays JSON-safe.

## [1.0.0] — 2026-08-19

Initial framework: static ES-module app, Cloudflare Worker + D1 backend, teacher dashboard
with a visual escape builder, and three built-in escapes.
