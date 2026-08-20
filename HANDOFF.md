# Handoff — Classroom Escape Hub

**Date:** 2026-08-20  
**Repo:** `shiebenaderet/firstescape` (GitHub). Owner has talked about renaming the repo to `escape-room`; that has **not** been done.  
**Live site:** https://escape.mrbsocialstudies.org  
**API:** https://escape-hub-api.shiebenaderet.workers.dev  
**HEAD on `main`:** `9d89eed` — *Declutter hub, fix icon picker, add room visibility from dashboard*  
**GitHub Pages:** rebuilds automatically from `main`. Last verified deploy succeeded right after `9d89eed`.

This document is for a **new Claude (desktop) session**. Read this first, then `README.md` (framework authoring) and `server/README.md` (Worker API). `README.md` is **stale** in a few places (still talks about Google Form as the primary results path; does not mention the teacher dashboard, Cipher Lab, or the Worker). Trust this file + the code over README when they disagree.

---

## What this product is

A teacher-facing web app for **collaborative classroom escape-room games**. Students work in teams on one laptop (or a few), solve a sequence of puzzles, and “escape.” Teachers browse a hub of rooms, share a direct link, and later review completions from every device.

The original product was a single-file HTML game (`legacy/original-game.html`). It was rebuilt into a **static, no-build vanilla JS framework** (HTML + CSS + ES modules) plus a small **Cloudflare Worker + D1** backend for login, central results, custom rooms, and hub visibility.

Owner / teacher: Mr. B (social studies). Classroom passphrase is already in use — see Secrets below. Do **not** invent a new password without asking.

---

## Current live behavior (what students / teachers actually see)

### Student hub (`#/`)

- Catalog of **visible** rooms only (`listVisibleEscapes()`).
- Cards are intentionally **simple**: icon, estimated time, title, summary, Start/Resume. Challenge count + grade band as small meta.
- **No** copy-link, results, or visibility controls on student cards (those moved to the dashboard).
- Header: bigger-text toggle + Teacher button.
- Empty state if every room is hidden: “No escape rooms are open right now…”

### Playing a room (`#/escape/<id>`)

- Engine in `src/engine/engine.js`: linear (default) or non-linear, timer, hints, `localStorage` resume, victory, optional `activity.media` clues.
- Direct links still work even if the room is hidden from the hub.

### Local per-device results (`#/results/<id>`)

- Still exists. Completions also POST to the API by default (`src/engine/results.js`), so the **dashboard Results tab is the real teacher view**.

### Teacher dashboard (`#/teacher`)

- Login with a **single shared passphrase** → HMAC JWT (~12h) in `sessionStorage`.
- Two tabs: **Escape Builder** (default) and **Results**.
- **Rooms list** (builder home):
  - Built-in rooms: Visible/Hidden toggle (D1 `settings.hidden_escapes`) + Copy link. Built-ins are not editable in the builder.
  - Custom rooms: Published/Draft toggle (that *is* their hub visibility), Copy link, Edit, Delete.
  - Hidden / unpublished rooms stay off the hub; **direct links still work**.
- **Visual builder:** activity palette, reorderable challenges, per-type forms (`src/activities/schemas.js`), emoji picker, **live preview** using real activity renderers, save draft / publish.
- **Icon picker bug is fixed:** choosing an emoji closes the popup and does **not** remount the whole editor.
- **Results:** summary tiles, filter by escape, table, CSV/JSON export. Data is all classes/devices from D1.

---

## Architecture (where to look)

```
index.html                 App shell
src/main.js                Hash router + boot
src/config.js              API_BASE (public Worker URL)
src/styles.css             All UI tokens / theme
src/engine/                Play loop, storage, results sinks, API client, prefs
src/activities/            Puzzle types + registry (`index.js`) + builder schemas
src/content/               Built-in escapes + activity bank
src/views/                 Hub, victory, media clues, teacher dashboard
assets/fonts/              Self-hosted Fredoka + Atkinson Hyperlegible
assets/media/              Placeholder video/audio + VTT (ffmpeg, not real teacher recordings)
server/                    Cloudflare Worker + D1
legacy/original-game.html  Original single-file game (reference only)
```

**Frontend host:** GitHub Pages from `main`, custom domain `escape.mrbsocialstudies.org` (`CNAME` file in repo). `.nojekyll` is present so Pages serves ES modules as-is.

**Backend:** Worker `escape-hub-api` + D1 `escape_hub`  
- Cloudflare account id: `579625a651e4146448c47b3b177aa8ee`  
- D1 `database_id`: `1a00f537-2f3b-4700-a953-a79ec3837a7b` (in `server/wrangler.jsonc`)  
- CORS `ALLOWED_ORIGINS`: `https://escape.mrbsocialstudies.org`, `http://localhost:8000`, `http://127.0.0.1:8000`

**Auth model:** one teacher passphrase (`TEACHER_PASSWORD`) hashed with SHA-256 and compared in constant time. Session is a 12h HMAC JWT signed with `AUTH_SECRET`. Not per-teacher, not Google, not Cloudflare Access.

### API (source of truth: `server/src/index.js`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | no | Health |
| GET | `/api/visibility` | no | `{ hidden: string[] }` built-in ids hidden from hub |
| GET | `/api/escapes` | no | Published custom escapes |
| POST | `/api/results` | no | `{ escapeId, record }` → D1 `completions` |
| POST | `/api/login` | no | `{ password }` → `{ token }` |
| GET | `/api/admin/results[?escapeId=]` | Bearer | All completions |
| DELETE | `/api/admin/results/:id` | Bearer | Delete one |
| PUT | `/api/admin/visibility` | Bearer | `{ hidden: [] }` |
| GET | `/api/admin/escapes` | Bearer | Custom escapes incl. drafts |
| PUT | `/api/admin/escapes/:id` | Bearer | Upsert `{ title, definition, published }` |
| DELETE | `/api/admin/escapes/:id` | Bearer | Delete custom escape |

Migrations: `server/migrations/0001_init.sql` (completions + escapes), `0002_settings.sql` (key/value; used for `hidden_escapes`). Both are applied **remotely**.

### Built-in rooms

| id | Title | Notes |
| --- | --- | --- |
| `getting-to-know-you` | Getting to Know You | Original-style mixer; some bank activities include placeholder media clues |
| `cipher-lab` | Escape the Cipher Lab | **Linear**, one-laptop-per-group (was non-linear; changed on purpose) |
| `quick-mixer` | Quick Mixer | Short |

Custom rooms live in D1, not in git. Hub merges them at boot via `registerCustomEscapes()`.

### Activity types

**Implemented in the engine** (`src/activities/index.js`):  
`team-setup`, `multiple-choice`, `text-answer`, `team-responses`, `computed-lock`, `constructed-answer`, `cipher`, `combination-lock`, `sequence`, `hidden-clue`, `geo-check`.

**In the builder palette** (`src/activities/schemas.js`): everything above **except** `sequence`, `geo-check`, and `computed-lock`. Adding those is a schema + form-fields job; the renderers already exist.

### Results sinks (`src/engine/results.js`)

Default: `local` **plus** `api` whenever `API_BASE` is set (unless `results.central === false`). Google Form is legacy only. `#/results/<id>` is per-browser; dashboard Results is central.

---

## How to run locally

Frontend **must** be served over HTTP (ES modules; `file://` fails):

```bash
python3 -m http.server 8000
# http://localhost:8000/
```

Worker (only needed if you are changing the API):

```bash
cd server
npm install
cp .dev.vars.example .dev.vars   # fill TEACHER_PASSWORD + AUTH_SECRET; never commit
npm run migrate:local
npm run dev                      # http://127.0.0.1:8787
```

To point the frontend at local API, temporarily change `src/config.js` `API_BASE` (do not commit a localhost URL). Production `API_BASE` is the workers.dev URL.

Lint substitute (no test suite, no bundler):

```bash
for f in $(find src server/src -name '*.js'); do node --check "$f" || exit 1; done
```

### Deploy

- **Frontend:** merge/push to `main` → GitHub Pages. Custom domain is already wired.
- **Worker:** `cd server && npm run deploy` (needs a Cloudflare API token in the environment or `wrangler login`). After schema changes: `npm run migrate:remote` then deploy.
- Do **not** commit secrets, `.dev.vars`, or API tokens.

---

## Secrets and security (read this)

Stored as **Cloudflare Worker secrets** (not in the repo):

- `TEACHER_PASSWORD` — classroom passphrase already in use. Ask the teacher if you need it for local `.dev.vars`. Do not rotate it unless they ask (students/teachers already know it).
- `AUTH_SECRET` — random HMAC key for JWTs.

**Do not commit either.** Do not put them in `HANDOFF.md`, `AGENTS.md`, `wrangler.jsonc`, or chat logs you might paste into git.

A Cloudflare **API token was pasted in a previous cloud-agent chat** and used to deploy. The teacher was asked to **revoke/rotate that token**. Do not reuse any token from old transcripts. Prefer Cursor Secrets / `wrangler login` next time.

Teacher JWT lives in `sessionStorage` (`escape-hub:v1:teacher-token`), so it clears when the tab closes.

---

## What shipped most recently (`9d89eed`, live)

1. Student hub cards decluttered (teacher tools removed).
2. Dashboard Rooms list: built-in + custom, visibility toggles, copy link.
3. Backend: `settings` table + `GET /api/visibility` + `PUT /api/admin/visibility`. Verified live: `{"hidden":[]}`.
4. Emoji picker: closes on select; no full editor remount.

---

## Open work (priority order)

These were in flight or explicitly requested and are **not done**:

### 1. Teacher video/audio recording flow (highest product ask)

Playback already works: `activity.media` → `src/views/media.js` (video or audio + on-screen text + optional VTT). Built-in placeholders live in `assets/media/` (`locker-riddle.mp4`, `candle-riddle.m4a` + matching `.vtt`). The builder has **no** UI to attach or record media.

**Recommended flow to implement** (not built yet — this is the agreed direction):

1. In the activity editor, a **“Clue recording”** section: none / record video / record audio / upload file.
2. Teacher uses **MediaRecorder** in the dashboard (camera or mic). Show a preview, retake, keep.
3. Store the blob. GitHub Pages cannot accept uploads, so the durable path is **Cloudflare R2** (or similar) with a new Worker upload endpoint (auth required) returning a public or signed URL. Putting large binaries in D1 is a bad fit.
4. Persist `activity.media = { type, src, text, label, captions? }` on the escape definition.
5. Always keep the riddle **text on screen** (accessibility + silent classrooms). Captions optional; generating VTT from speech is a later nice-to-have.
6. Student player already handles this shape — do not reinvent playback.

Until R2 exists, a stopgap is: teacher records elsewhere, drops files into `assets/media/`, and we add a builder field for `src` path. That is worse UX but ships without new infra.

### 2. Visual polish

Owner still feels the UI has “a lot going on.” Partial calm-down happened (cream, coral/teal, Fredoka + Atkinson, simpler cards). Remaining: tighten dashboard density, fewer competing colors, maybe fewer emoji-as-UI. Tokens live in `src/styles.css` `:root`.

### 3. Builder gaps

Add `sequence`, `geo-check`, and probably `computed-lock` to `ACTIVITY_SCHEMAS` so teachers can author them without code. Engine support already exists.

### 4. Auth

Single passphrase is enough for one teacher this year. Future: per-teacher accounts, Google, or Cloudflare Access. Do not expand this unless asked.

### 5. Docs drift

Update `README.md` (and `AGENTS.md` results section) so they mention the Worker, dashboard, Cipher Lab, and visibility. `AGENTS.md` still claims “no backend.”

### 6. Repo rename

Owner wanted GitHub repo `firstescape` → `escape-room`. Not done. Live domain can stay `escape.mrbsocialstudies.org`.

---

## Parallel thread: domains (not this repo)

Useful context; do not mix into Escape Hub PRs unless asked.

- **`escape.mrbsocialstudies.org`** — GitHub Pages. DNS is on **Cloudflare** (`aaron.ns.cloudflare.com` / `nucum.ns.cloudflare.com`). CNAME `escape` → `shiebenaderet.github.io`. An earlier NXDOMAIN was because the record was added in the wrong DNS (Squarespace/Google) instead of Cloudflare.
- **`benaderet.com`** — ProtonMail + Squarespace site. Nameservers were moved to Cloudflare. Confirmed: NS Cloudflare, MX `mail.protonmail.ch`, SPF + verification TXT, three DKIM CNAMEs, apex A `198.49.23.145`, www → `ext-sq.squarespace.com`. **Registrar transfer to Cloudflare was pending** (waiting on Squarespace EPP/auth code; domain unlocked, DNSSEC off). Transfer **adds** 1 year on top of remaining term. Keep mail and Squarespace where they are; only DNS + registration move.

---

## Suggested first moves in a desktop session

1. Pull `main` (`9d89eed` or later) and skim `src/views/hub.js`, `src/views/teacher/builder.js`, `server/src/index.js`.
2. Confirm live hub: https://escape.mrbsocialstudies.org and dashboard `#/teacher`.
3. Ask the teacher which to do first: **recording flow**, **more polish**, or **builder types**.
4. If changing the Worker, use a Cloudflare token from the user’s secret store / `wrangler login` — never paste tokens into git or this file.
5. Push frontend via `main`; deploy Worker separately when API changes.

---

## Working tree / branches

- Preferred integration branch: **`main`**.
- Merged PRs: #1 framework rebuild, #2 teacher dashboard.
- Feature branch `cursor/teacher-dashboard-989b` is merged and matches `main` at `9d89eed`.
- Working tree was clean at handoff time; this file is the only new artifact unless you add more.

Do not force-push `main`. Do not commit `.dev.vars`, tokens, or `server/node_modules`.
