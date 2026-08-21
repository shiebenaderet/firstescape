# Teacher Recording Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher record a video or audio riddle clue in the dashboard, or upload one, and attach it to a challenge — stored in Cloudflare R2 and served to students from a custom domain.

**Architecture:** A new authenticated `POST /api/admin/media` route on the existing Worker streams an uploaded blob into an R2 bucket and returns an absolute URL. A new dashboard module captures media with `MediaRecorder`, previews it locally, and uploads only on confirmation. The resulting URL is stored in the existing `activity.media.src` field, so the student-side player is untouched.

**Tech Stack:** Vanilla ES modules (no build step), Cloudflare Workers, R2, D1, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-20-teacher-recording-flow-design.md`

## Global Constraints

- **No dependencies, no build step.** Plain ES modules; tests use `node --test` only.
- **Custom escapes must be JSON-serializable.** No functions in anything reachable from the builder — `JSON.stringify` drops them silently on the way into D1.
- **Any element toggled with the `hidden` attribute that also has a CSS `display` rule MUST ship a `.thing[hidden] { display: none; }` rule.** `test/styles.test.js` enforces this and will fail the build otherwise.
- **Upload cap: 40 MB.** Allowed content types: `video/webm`, `video/mp4`, `audio/webm`, `audio/mpeg`, `audio/mp4`.
- **R2 object keys are server-generated**, always under the `clues/` prefix. The client never supplies a path.
- **A recording never gates a puzzle.** `media.text` is required whenever `media.src` is set.
- Run `npm test` before every commit. All existing tests must stay green (34 at plan time).

## Prerequisites (owner action — blocks Task 2 onward)

Task 1 can be done immediately. Tasks 2+ need R2 enabled.

1. Enable R2: `dash.cloudflare.com` → R2 → Enable (requires a payment method; free tier is 10 GB / 1M writes per month).
2. Create the bucket: `cd server && npx wrangler r2 bucket create escape-hub-media`
3. Connect the custom domain in the dashboard: R2 → `escape-hub-media` → Settings → Custom Domains → Add → `media.mrbsocialstudies.org`.

---

### Task 1: Pure media helpers (extension mapping, validation)

No R2 required. Establishes the vocabulary later tasks import.

**Files:**
- Create: `server/src/media.js`
- Test: `test/media.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ALLOWED_MEDIA_TYPES: Record<string, string>` — content type → file extension
  - `MAX_MEDIA_BYTES: number` (41943040)
  - `extensionForType(contentType: string): string | null`
  - `validateUpload({ contentType: string, contentLength: number|null }): { ok: true } | { ok: false, status: 413|415, error: string }`
  - `mediaKey(contentType: string, uuid: string): string | null` — e.g. `clues/<uuid>.webm`

- [ ] **Step 1: Write the failing test**

Create `test/media.test.js`:

```js
// Unit tests for media upload validation and key generation.
// These are pure functions so the rules are testable without R2 or a browser.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  extensionForType,
  validateUpload,
  mediaKey,
} from '../server/src/media.js';

test('extensionForType maps every allowed type to a file extension', () => {
  assert.equal(extensionForType('video/webm'), 'webm');
  assert.equal(extensionForType('video/mp4'), 'mp4');
  assert.equal(extensionForType('audio/webm'), 'weba');
  assert.equal(extensionForType('audio/mpeg'), 'mp3');
  assert.equal(extensionForType('audio/mp4'), 'm4a');
});

test('extensionForType ignores codec parameters browsers append', () => {
  // MediaRecorder reports e.g. 'video/webm;codecs=vp9,opus'.
  assert.equal(extensionForType('video/webm;codecs=vp9,opus'), 'webm');
  assert.equal(extensionForType('audio/webm; codecs=opus'), 'weba');
});

test('extensionForType rejects anything not on the allowlist', () => {
  assert.equal(extensionForType('application/zip'), null);
  assert.equal(extensionForType('text/html'), null);
  assert.equal(extensionForType(''), null);
  assert.equal(extensionForType(undefined), null);
});

test('validateUpload accepts a normal recording', () => {
  assert.deepEqual(validateUpload({ contentType: 'video/webm', contentLength: 5_000_000 }), { ok: true });
});

test('validateUpload rejects an unsupported type with 415', () => {
  const r = validateUpload({ contentType: 'application/zip', contentLength: 100 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 415);
});

test('validateUpload rejects an oversized file with 413', () => {
  const r = validateUpload({ contentType: 'video/webm', contentLength: MAX_MEDIA_BYTES + 1 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  // The message should tell the teacher what to do, not just that it failed.
  assert.match(r.error, /40 MB/);
});

test('validateUpload rejects an unknown length rather than streaming unbounded', () => {
  const r = validateUpload({ contentType: 'video/webm', contentLength: null });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
});

test('validateUpload rejects an empty body', () => {
  const r = validateUpload({ contentType: 'video/webm', contentLength: 0 });
  assert.equal(r.ok, false);
});

test('mediaKey namespaces under clues/ and uses the right extension', () => {
  assert.equal(mediaKey('video/webm', 'abc-123'), 'clues/abc-123.webm');
  assert.equal(mediaKey('audio/mpeg', 'def-456'), 'clues/def-456.mp3');
});

test('mediaKey returns null for a disallowed type', () => {
  assert.equal(mediaKey('application/zip', 'abc'), null);
});

test('every allowed type has a non-empty extension', () => {
  for (const [type, ext] of Object.entries(ALLOWED_MEDIA_TYPES)) {
    assert.ok(ext && typeof ext === 'string', `${type} has no extension`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../server/src/media.js'`

- [ ] **Step 3: Write the implementation**

Create `server/src/media.js`:

```js
// Media upload rules, kept pure so they can be unit-tested without R2 or a browser.
//
// Shared by the Worker's POST /api/admin/media route. The client never chooses the storage
// key or trusts its own size check — both are decided here, server-side.

/** Content types a teacher may upload, mapped to the extension we store them under. */
export const ALLOWED_MEDIA_TYPES = {
  'video/webm': 'webm',   // Chrome, Edge, Firefox, ChromeOS
  'video/mp4': 'mp4',     // Safari
  'audio/webm': 'weba',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
};

/** 40 MB. A 2-minute 720p clip is 15-25 MB; this leaves headroom without risking the free tier. */
export const MAX_MEDIA_BYTES = 40 * 1024 * 1024;

/** Normalize 'video/webm;codecs=vp9' -> 'video/webm', then look up the extension. */
export function extensionForType(contentType) {
  if (!contentType) return null;
  const base = String(contentType).split(';')[0].trim().toLowerCase();
  return ALLOWED_MEDIA_TYPES[base] || null;
}

/**
 * Decide whether an upload may proceed, before any bytes are read.
 * @returns {{ok: true} | {ok: false, status: number, error: string}}
 */
export function validateUpload({ contentType, contentLength }) {
  if (!extensionForType(contentType)) {
    return { ok: false, status: 415, error: 'That file type is not supported. Record a video or audio clip, or upload an .mp4, .webm, .mp3, or .m4a file.' };
  }
  // A missing length means a chunked body we cannot bound up front — refuse rather than
  // stream something unbounded into storage.
  if (contentLength == null || Number.isNaN(contentLength) || contentLength <= 0) {
    return { ok: false, status: 413, error: 'The upload was empty or its size could not be determined.' };
  }
  if (contentLength > MAX_MEDIA_BYTES) {
    const mb = Math.round(contentLength / (1024 * 1024));
    return { ok: false, status: 413, error: `That clip is about ${mb} MB — the limit is 40 MB. Try a shorter take, or record audio instead of video.` };
  }
  return { ok: true };
}

/** Server-chosen storage key. Always under clues/, so a client can never escape the prefix. */
export function mediaKey(contentType, uuid) {
  const ext = extensionForType(contentType);
  return ext ? `clues/${uuid}.${ext}` : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all previous tests still green, 11 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/media.js test/media.test.js
git commit -m "Add pure media upload validation and key generation"
```

---

### Task 2: R2 binding and configuration

**Requires:** R2 enabled and the bucket created (see Prerequisites).

**Files:**
- Modify: `server/wrangler.jsonc`

**Interfaces:**
- Consumes: nothing.
- Produces: `env.MEDIA` (R2 bucket binding), `env.MEDIA_LIMITER` (rate limiter), `env.MEDIA_BASE_URL` (string).

- [ ] **Step 1: Add the bindings**

In `server/wrangler.jsonc`, add a third entry to the existing `ratelimits` array (namespace_id 1001 and 1002 are taken):

```jsonc
{
  // Media uploads: tight, since only the teacher ever uploads.
  "name": "MEDIA_LIMITER",
  "namespace_id": "1003",
  "simple": { "limit": 5, "period": 60 }
}
```

Add `MEDIA_BASE_URL` to the existing `vars` object:

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://escape.mrbsocialstudies.org,http://localhost:8000,http://127.0.0.1:8000",
  "MEDIA_BASE_URL": "https://media.mrbsocialstudies.org"
},
```

Add a new top-level `r2_buckets` array:

```jsonc
"r2_buckets": [
  {
    "binding": "MEDIA",
    "bucket_name": "escape-hub-media"
  }
],
```

- [ ] **Step 2: Verify the bindings resolve without deploying**

Run: `cd server && npx wrangler deploy --dry-run`
Expected: output lists `env.MEDIA (escape-hub-media) R2 Bucket`, `env.MEDIA_LIMITER (5 requests/60s) Rate Limit`, and `env.MEDIA_BASE_URL`.

If `env.MEDIA` is missing, the bucket does not exist yet — run `npx wrangler r2 bucket create escape-hub-media`.

- [ ] **Step 3: Commit**

```bash
git add server/wrangler.jsonc
git commit -m "Add R2 bucket, media rate limiter, and media base URL bindings"
```

---

### Task 3: The upload endpoint

**Files:**
- Modify: `server/src/index.js` (import at top; new route inside the `/api/admin/` block that begins at line 220)

**Interfaces:**
- Consumes: `validateUpload`, `mediaKey` from `server/src/media.js`; existing `requireAuth`, `isRateLimited`, `json` helpers.
- Produces: `POST /api/admin/media` → `201 { url, key, type, bytes }`.

- [ ] **Step 1: Add the import**

At the top of `server/src/index.js`, below the existing header comment:

```js
import { validateUpload, mediaKey } from './media.js';
```

Also extend the header comment's endpoint list with:

```
//   POST   /api/admin/media          -> upload a clue recording to R2
```

- [ ] **Step 2: Add the route**

Inside the `if (pathname.startsWith('/api/admin/')) {` block, after the `claims` check and before the results routes:

```js
// ---- Media upload (clue recordings) ----
if (pathname === '/api/admin/media' && method === 'POST') {
  if (await isRateLimited(env.MEDIA_LIMITER, request)) {
    return json({ error: 'Too many uploads. Please wait a minute and try again.' }, 429, request, env);
  }
  if (!env.MEDIA) {
    return json({ error: 'Media storage is not configured on this server.' }, 500, request, env);
  }

  const contentType = request.headers.get('Content-Type') || '';
  const rawLength = request.headers.get('Content-Length');
  const contentLength = rawLength == null ? null : Number(rawLength);

  // Validate BEFORE touching the body, so an oversized upload is refused without buffering.
  const check = validateUpload({ contentType, contentLength });
  if (!check.ok) return json({ error: check.error }, check.status, request, env);

  const key = mediaKey(contentType, crypto.randomUUID());
  const baseType = contentType.split(';')[0].trim().toLowerCase();

  // Stream straight through to R2 — Workers cap memory at 128 MB, so never buffer the file.
  await env.MEDIA.put(key, request.body, {
    httpMetadata: { contentType: baseType, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const base = (env.MEDIA_BASE_URL || '').replace(/\/+$/, '');
  return json({ url: `${base}/${key}`, key, type: baseType, bytes: contentLength }, 201, request, env);
}
```

Note: keys are unique per upload, so the object is immutable — hence the long `cacheControl`. A replaced recording gets a new key and therefore a new URL, so caching can never serve a stale clip.

- [ ] **Step 3: Start the local Worker**

```bash
cd server
printf 'TEACHER_PASSWORD=localtest\nAUTH_SECRET=local-dev-secret\n' > .dev.vars
npx wrangler dev --local --port 8788
```

`.dev.vars` is gitignored. Leave this running in another terminal for the next step.

- [ ] **Step 4: Verify every response path with curl**

```bash
# Get a token
TOKEN=$(curl -s -X POST http://127.0.0.1:8788/api/login \
  -H 'Content-Type: application/json' -d '{"password":"localtest"}' \
  | sed 's/.*"token":"\([^"]*\)".*/\1/')

# 401 — no token
curl -s -o /dev/null -w "no auth: %{http_code}\n" -X POST http://127.0.0.1:8788/api/admin/media \
  -H 'Content-Type: video/webm' --data-binary 'fake'

# 415 — bad type
curl -s -w "\nbad type: %{http_code}\n" -X POST http://127.0.0.1:8788/api/admin/media \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/zip' --data-binary 'fake'

# 201 — success
head -c 1000000 /dev/urandom > /tmp/clip.webm
curl -s -w "\nok: %{http_code}\n" -X POST http://127.0.0.1:8788/api/admin/media \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: video/webm' --data-binary @/tmp/clip.webm

# 413 — too large (41 MB)
head -c 43000000 /dev/urandom > /tmp/big.webm
curl -s -w "\ntoo big: %{http_code}\n" -X POST http://127.0.0.1:8788/api/admin/media \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: video/webm' --data-binary @/tmp/big.webm

rm -f /tmp/clip.webm /tmp/big.webm
```

Expected: `401`, `415`, `201` with a JSON body containing `url`/`key`/`type`/`bytes`, then `413`.

- [ ] **Step 5: Confirm the object actually landed in local R2**

Run: `cd server && npx wrangler r2 object get escape-hub-media/<key from the 201 response> --local --file /tmp/out.webm && ls -l /tmp/out.webm`
Expected: a ~1 MB file. Then `rm -f /tmp/out.webm`.

- [ ] **Step 6: Clean up and commit**

```bash
rm -f server/.dev.vars
npm test          # existing suite must still pass
git add server/src/index.js
git commit -m "Add authenticated media upload endpoint backed by R2"
```

---

### Task 4: Upload client

`apiClient.request()` hardcodes `Content-Type: application/json` and `JSON.stringify(body)` (see `src/engine/apiClient.js:34-42`), which would turn a Blob into `"{}"`. This needs its own function.

**Files:**
- Modify: `src/engine/apiClient.js` (append)

**Interfaces:**
- Consumes: existing `getToken`, `API_BASE`.
- Produces: `uploadMedia(blob: Blob, kind: 'video'|'audio'): Promise<{url, key, type, bytes}>`

- [ ] **Step 1: Add the function**

Append to `src/engine/apiClient.js`:

```js
/* ---- media uploads ---- */
// Sends the raw blob, so it deliberately bypasses request() (which is JSON-only).
export async function uploadMedia(blob, kind) {
  const res = await fetch(`${API_BASE}/api/admin/media?type=${encodeURIComponent(kind)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': blob.type || (kind === 'audio' ? 'audio/webm' : 'video/webm'),
    },
    body: blob,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Upload failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
```

- [ ] **Step 2: Verify the module still loads**

Run: `npm test`
Expected: PASS — `test/modules.test.js` imports the module graph, so a syntax or import error fails here.

- [ ] **Step 3: Commit**

```bash
git add src/engine/apiClient.js
git commit -m "Add uploadMedia client for raw blob uploads"
```

---

### Task 5: Recorder state machine (pure)

Separating the transitions from the browser APIs makes the logic testable without a DOM.

**Files:**
- Create: `src/views/teacher/recorderState.js`
- Test: `test/recorderState.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `initialRecorderState(media)`, `recorderReducer(state, action)` where state is `{ phase: 'idle'|'recording'|'review'|'uploading'|'saved'|'error', kind, blobUrl, media, error }`.

- [ ] **Step 1: Write the failing test**

Create `test/recorderState.test.js`:

```js
// The recorder's transitions, tested without a browser. Keeping this pure means the tricky
// part (what happens on retake, on a failed upload, on remove) is verifiable in CI.

import test from 'node:test';
import assert from 'node:assert/strict';

import { initialRecorderState, recorderReducer } from '../src/views/teacher/recorderState.js';

test('starts idle when the challenge has no recording', () => {
  assert.equal(initialRecorderState(null).phase, 'idle');
});

test('starts saved when the challenge already has one', () => {
  const s = initialRecorderState({ type: 'video', src: 'https://x/clues/a.webm' });
  assert.equal(s.phase, 'saved');
  assert.equal(s.media.src, 'https://x/clues/a.webm');
});

test('start -> recording, stop -> review', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'video' });
  assert.equal(s.phase, 'recording');
  assert.equal(s.kind, 'video');
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  assert.equal(s.phase, 'review');
  assert.equal(s.blobUrl, 'blob:x');
});

test('retake returns to idle and drops the local clip', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'audio' });
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  s = recorderReducer(s, { type: 'retake' });
  assert.equal(s.phase, 'idle');
  assert.equal(s.blobUrl, null);
});

test('a failed upload returns to review so the recording is never lost', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'video' });
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  s = recorderReducer(s, { type: 'uploading' });
  assert.equal(s.phase, 'uploading');
  s = recorderReducer(s, { type: 'uploadFailed', error: 'network down' });
  assert.equal(s.phase, 'review', 'must return to review, not idle');
  assert.equal(s.blobUrl, 'blob:x', 'the local clip must survive a failed upload');
  assert.equal(s.error, 'network down');
});

test('a successful upload lands in saved with the returned media', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'video' });
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  s = recorderReducer(s, { type: 'uploading' });
  s = recorderReducer(s, { type: 'uploaded', media: { type: 'video', src: 'https://x/clues/b.webm' } });
  assert.equal(s.phase, 'saved');
  assert.equal(s.media.src, 'https://x/clues/b.webm');
  assert.equal(s.error, null);
});

test('remove clears back to idle with no media', () => {
  let s = initialRecorderState({ type: 'video', src: 'https://x/a.webm' });
  s = recorderReducer(s, { type: 'remove' });
  assert.equal(s.phase, 'idle');
  assert.equal(s.media, null);
});

test('a file picked from disk goes straight to review', () => {
  const s = recorderReducer(initialRecorderState(null), { type: 'filePicked', blobUrl: 'blob:f', kind: 'video' });
  assert.equal(s.phase, 'review');
  assert.equal(s.kind, 'video');
});

test('unknown actions leave the state untouched', () => {
  const s = initialRecorderState(null);
  assert.deepEqual(recorderReducer(s, { type: 'nonsense' }), s);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/views/teacher/recorderState.js'`

- [ ] **Step 3: Write the implementation**

Create `src/views/teacher/recorderState.js`:

```js
// Recorder transitions, kept free of browser APIs so they can be unit-tested.
//
// phases: idle -> recording -> review -> uploading -> saved
//         review --retake--> idle
//         uploading --uploadFailed--> review   (the local clip is deliberately preserved)

export function initialRecorderState(media) {
  return media && media.src
    ? { phase: 'saved', kind: media.type || 'video', blobUrl: null, media, error: null }
    : { phase: 'idle', kind: 'video', blobUrl: null, media: null, error: null };
}

export function recorderReducer(state, action) {
  switch (action.type) {
    case 'start':
      return { ...state, phase: 'recording', kind: action.kind, blobUrl: null, error: null };
    case 'stopped':
      return { ...state, phase: 'review', blobUrl: action.blobUrl, error: null };
    case 'filePicked':
      return { ...state, phase: 'review', kind: action.kind, blobUrl: action.blobUrl, error: null };
    case 'retake':
      return { ...state, phase: 'idle', blobUrl: null, error: null };
    case 'uploading':
      return { ...state, phase: 'uploading', error: null };
    case 'uploaded':
      return { ...state, phase: 'saved', media: action.media, blobUrl: null, error: null };
    // Return to review, not idle: a network failure must never discard the take.
    case 'uploadFailed':
      return { ...state, phase: 'review', error: action.error };
    case 'remove':
      return { ...state, phase: 'idle', media: null, blobUrl: null, error: null };
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 9 new tests.

- [ ] **Step 5: Commit**

```bash
git add src/views/teacher/recorderState.js test/recorderState.test.js
git commit -m "Add recorder state machine with tests"
```

---

### Task 6: Recorder UI

**Files:**
- Create: `src/views/teacher/recorder.js`
- Modify: `src/styles.css` (append)

**Interfaces:**
- Consumes: `el`, `clear` from `../../engine/dom.js`; `uploadMedia` from `../../engine/apiClient.js`; `initialRecorderState`, `recorderReducer` from `./recorderState.js`.
- Produces: `renderRecorder(activity: object, onChange: () => void): HTMLElement`

- [ ] **Step 1: Write the module**

Create `src/views/teacher/recorder.js`:

```js
// "Clue recording" section for the challenge editor.
//
// Records with MediaRecorder (camera or mic), previews locally, and uploads only when the
// teacher confirms — a retake never touches the network. Falls back to a file picker when
// recording is unavailable, so this is never a dead end.
//
// Mutates activity.media in place and calls onChange() so the builder's live preview updates.

import { el, clear } from '../../engine/dom.js';
import { uploadMedia } from '../../engine/apiClient.js';
import { initialRecorderState, recorderReducer } from './recorderState.js';

const MIME_CANDIDATES = {
  video: ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'],
  audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'],
};

function canRecord() {
  return typeof MediaRecorder !== 'undefined'
    && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function pickMime(kind) {
  for (const t of MIME_CANDIDATES[kind]) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function fmtBytes(n) {
  if (!n) return '';
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

export function renderRecorder(activity, onChange) {
  let state = initialRecorderState(activity.media);
  let stream = null;
  let recorder = null;
  let chunks = [];
  let blob = null;
  let timerId = null;
  let seconds = 0;

  const host = el('div', { class: 'recorder' });

  function dispatch(action) {
    state = recorderReducer(state, action);
    draw();
  }

  function stopStream() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  async function startRecording(kind) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        kind === 'audio' ? { audio: true } : { audio: true, video: { width: 1280, height: 720 } }
      );
    } catch {
      state = { ...state, error: 'Could not use the camera or microphone. Check the browser permission, or upload a file instead.' };
      draw();
      return;
    }
    const mimeType = pickMime(kind);
    chunks = [];
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      blob = new Blob(chunks, { type: recorder.mimeType || mimeType || '' });
      stopStream();
      dispatch({ type: 'stopped', blobUrl: URL.createObjectURL(blob) });
    };
    recorder.start();
    seconds = 0;
    dispatch({ type: 'start', kind });
    timerId = setInterval(() => { seconds++; const t = host.querySelector('.rec-timer'); if (t) t.textContent = clock(seconds); }, 1000);
  }

  function clock(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function onFile(file) {
    if (!file) return;
    blob = file;
    const kind = file.type.startsWith('audio') ? 'audio' : 'video';
    dispatch({ type: 'filePicked', blobUrl: URL.createObjectURL(file), kind });
  }

  async function confirmUpload() {
    dispatch({ type: 'uploading' });
    try {
      const result = await uploadMedia(blob, state.kind);
      const media = {
        ...(activity.media || {}),
        type: state.kind,
        src: result.url,
        bytes: result.bytes,
      };
      delete media.placeholder;      // a real recording is not a stand-in
      activity.media = media;
      dispatch({ type: 'uploaded', media });
      onChange();
    } catch (err) {
      dispatch({ type: 'uploadFailed', error: err.message || 'Upload failed.' });
    }
  }

  function removeRecording() {
    // The R2 object is intentionally left in place — another draft may still reference it.
    delete activity.media;
    dispatch({ type: 'remove' });
    onChange();
  }

  function textField() {
    // The riddle text is what keeps a clue usable without sound. Required whenever a
    // recording exists, and surfaced right here so it is not buried elsewhere in the form.
    const media = activity.media || {};
    const input = el('textarea', {
      class: 'field',
      rows: 2,
      placeholder: 'Type the riddle exactly as you read it aloud…',
    }, media.text || '');
    input.addEventListener('input', () => {
      activity.media = { ...(activity.media || {}), text: input.value };
      warn.hidden = !!input.value.trim();
      onChange();
    });
    const warn = el('p', { class: 'rec-warning', hidden: !!(media.text || '').trim() },
      '⚠️ Required: students who cannot hear the clip rely on this text.');
    return el('div', {}, [
      el('label', { class: 'field-label' }, 'Riddle text (shown on screen with the clip)'),
      input,
      warn,
    ]);
  }

  function draw() {
    clear(host);
    const rows = [];

    if (state.error) rows.push(el('p', { class: 'rec-error' }, state.error));

    if (state.phase === 'idle') {
      rows.push(el('div', { class: 'rec-actions' }, [
        canRecord() ? el('button', { class: 'btn btn-ghost', type: 'button', on: { click: () => startRecording('video') } }, '🎥 Record video') : null,
        canRecord() ? el('button', { class: 'btn btn-ghost', type: 'button', on: { click: () => startRecording('audio') } }, '🎤 Record audio') : null,
        filePicker(),
      ].filter(Boolean)));
      if (!canRecord()) {
        rows.push(el('p', { class: 'muted' }, 'This browser cannot record directly — upload a file you recorded elsewhere.'));
      }
    }

    if (state.phase === 'recording') {
      if (state.kind === 'video' && stream) {
        const preview = el('video', { class: 'rec-preview', muted: true, autoplay: true, playsInline: true });
        preview.srcObject = stream;
        rows.push(preview);
      }
      rows.push(el('div', { class: 'rec-actions' }, [
        el('span', { class: 'rec-dot' }, '●'),
        el('span', { class: 'rec-timer' }, clock(seconds)),
        el('button', { class: 'btn btn-primary', type: 'button', on: { click: stopRecording } }, 'Stop'),
      ]));
    }

    if (state.phase === 'review' || state.phase === 'uploading') {
      rows.push(playback(state.blobUrl, state.kind));
      const busy = state.phase === 'uploading';
      rows.push(el('div', { class: 'rec-actions' }, [
        el('button', { class: 'btn btn-primary', type: 'button', disabled: busy, on: { click: confirmUpload } }, busy ? 'Uploading…' : 'Use this'),
        el('button', { class: 'btn btn-ghost', type: 'button', disabled: busy, on: { click: () => dispatch({ type: 'retake' }) } }, 'Retake'),
      ]));
    }

    if (state.phase === 'saved' && state.media) {
      rows.push(playback(state.media.src, state.media.type));
      rows.push(el('div', { class: 'rec-actions' }, [
        el('span', { class: 'muted' }, `Uploaded${state.media.bytes ? ` · ${fmtBytes(state.media.bytes)}` : ''}`),
        el('button', { class: 'btn btn-ghost', type: 'button', on: { click: () => dispatch({ type: 'retake' }) } }, 'Replace'),
        el('button', { class: 'btn btn-ghost danger', type: 'button', on: { click: removeRecording } }, 'Remove'),
      ]));
      rows.push(textField());
    }

    for (const r of rows) host.appendChild(r);
  }

  function playback(src, kind) {
    return kind === 'audio'
      ? el('audio', { class: 'rec-playback', controls: true, src })
      : el('video', { class: 'rec-playback', controls: true, playsInline: true, src });
  }

  function filePicker() {
    const input = el('input', {
      type: 'file',
      accept: 'video/*,audio/*',
      class: 'rec-file',
    });
    input.addEventListener('change', () => onFile(input.files && input.files[0]));
    return el('label', { class: 'btn btn-ghost rec-file-label' }, ['📁 Upload a file', input]);
  }

  draw();
  return host;
}
```

- [ ] **Step 2: Add the styles**

Append to `src/styles.css`:

```css
/* ---------------- Clue recorder (builder) ---------------- */
.recorder { display: flex; flex-direction: column; gap: 10px; }
.rec-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rec-preview, .rec-playback { width: 100%; max-width: 420px; border-radius: var(--radius-sm); background: #000; }
.rec-dot { color: var(--red); font-size: 1.2rem; animation: rec-pulse 1.2s ease-in-out infinite; }
@keyframes rec-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .rec-dot { animation: none; } }
.rec-timer { font-variant-numeric: tabular-nums; font-weight: 800; }
.rec-error { color: var(--red); font-weight: 700; margin: 0; }
.rec-warning { color: var(--amber); font-weight: 700; font-size: 0.9rem; margin: 4px 0 0; }
.rec-warning[hidden] { display: none; }
.rec-file { display: none; }
.rec-file-label { cursor: pointer; }
```

Note the `.rec-warning[hidden]` rule — `test/styles.test.js` requires it because the element is toggled with `hidden` and the class sets no `display` of its own only if this is present. Include it.

- [ ] **Step 3: Verify the module graph and the CSS guard**

Run: `npm test`
Expected: PASS — including `elements toggled via the hidden attribute are not overridden by a display rule`.

- [ ] **Step 4: Commit**

```bash
git add src/views/teacher/recorder.js src/styles.css
git commit -m "Add clue recorder UI with MediaRecorder capture and upload"
```

---

### Task 7: Wire the recorder into the challenge editor

**Files:**
- Modify: `src/views/teacher/builder.js` (import at top; `challengeEditor` at line 288, which currently ends by pushing the hints field at line 303)

**Interfaces:**
- Consumes: `renderRecorder` from `./recorder.js`.
- Produces: nothing new.

- [ ] **Step 1: Add the import**

At the top of `src/views/teacher/builder.js`, with the other view imports:

```js
import { renderRecorder } from './recorder.js';
```

- [ ] **Step 2: Add the section to challengeEditor**

In `challengeEditor(a, i)`, immediately after the existing hints line:

```js
if (!Array.isArray(a.hints)) a.hints = [];
fields.push(stringListField('Hints (optional)', a.hints));
```

add:

```js
// Optional recorded clue. Collapsed unless the challenge already has one, so the common
// case (no recording) stays out of the way.
const recorderOpen = !!(a.media && a.media.src);
fields.push(el('details', { class: 'rec-details', open: recorderOpen }, [
  el('summary', {}, '🎙️ Clue recording (optional)'),
  renderRecorder(a, () => refreshPreview(a)),
]));
```

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: PASS.

Then manually: serve the site, open `#/teacher` → Escape Builder → New escape → add a challenge, and confirm a "Clue recording" section appears and expands.

```bash
npm run serve    # http://localhost:8000
```

- [ ] **Step 4: Commit**

```bash
git add src/views/teacher/builder.js
git commit -m "Add clue recording section to the challenge editor"
```

---

### Task 8: Block saving a recording without riddle text

**Files:**
- Modify: `src/views/teacher/builder.js` (the `save()` function)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Add the check**

In `save()`, after the existing `if (!escape.activities.length)` guard and before `showSave('info', 'Saving…')`:

```js
// A recorded clue must always have its text on screen — students who cannot hear the clip
// (deaf, broken speaker, silent reading) otherwise have no way to solve the puzzle.
const silent = escape.activities.find((a) => a.media && a.media.src && !String(a.media.text || '').trim());
if (silent) {
  showSave('error', `“${silent.title || 'A challenge'}” has a recording but no riddle text. Add the text so every student can solve it.`);
  return;
}
```

- [ ] **Step 2: Verify**

Run: `npm test`
Expected: PASS.

Manually: attach a recording, clear the riddle text, press Save, and confirm the error names the challenge and the save is blocked.

- [ ] **Step 3: Commit**

```bash
git add src/views/teacher/builder.js
git commit -m "Require riddle text whenever a challenge has a recording"
```

---

### Task 9: Deploy and verify end to end

**Files:**
- Modify: `server/README.md`, `README.md`, `AGENTS.md`

- [ ] **Step 1: Deploy the Worker**

```bash
cd server
npx wrangler deploy --dry-run     # confirm env.MEDIA and env.MEDIA_LIMITER are listed
npx wrangler deploy
```

- [ ] **Step 2: Verify the upload endpoint against production**

```bash
TOKEN=$(curl -s -X POST https://escape-hub-api.shiebenaderet.workers.dev/api/login \
  -H 'Content-Type: application/json' -d '{"password":"<real teacher password>"}' \
  | sed 's/.*"token":"\([^"]*\)".*/\1/')

head -c 500000 /dev/urandom > /tmp/probe.webm
curl -s -X POST https://escape-hub-api.shiebenaderet.workers.dev/api/admin/media \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: video/webm' --data-binary @/tmp/probe.webm
```

Expected: `201` with a `url` on `media.mrbsocialstudies.org`. Fetch that URL and confirm it returns 200 — this proves the custom domain is connected.

Then delete the probe object:

```bash
cd server && npx wrangler r2 object delete escape-hub-media/<key> --remote
rm -f /tmp/probe.webm
```

- [ ] **Step 3: Record a real clue end to end**

In the live dashboard: create a test escape, add a challenge, record a 10-second video, add riddle text, save, publish, then play the escape as a student and confirm the clip plays and the text shows. Delete the test escape afterward.

- [ ] **Step 4: Update the docs**

In `server/README.md`, add to the endpoints table:

```
| POST | `/api/admin/media` | Bearer | Upload a clue recording (max 40 MB) → `{ url, key, type, bytes }` |
```

and a Storage section noting the `escape-hub-media` bucket, the `media.mrbsocialstudies.org` custom domain, and that uploads are write-only (orphans are not collected).

In `README.md`, extend the media documentation to say recordings are made in the dashboard.

In `AGENTS.md`, under the media section, note that `media.src` may be either a relative repo path (built-ins) or an absolute R2 URL (dashboard recordings), and that the riddle text is mandatory for recorded clues.

- [ ] **Step 5: Commit and push**

```bash
npm test
git add -A
git commit -m "Document the media upload endpoint and recording flow"
git push origin main
```

---

### Task 10: Replace the placeholder clips

Only after Task 9 works. Closes the `TODO(teacher)` markers.

**Files:**
- Modify: `src/content/bank.js`
- Delete: `assets/media/locker-riddle.mp4`, `assets/media/candle-riddle.m4a` (and their `.vtt` files if the new recordings have no captions)

- [ ] **Step 1: Record the two real clues**

Through the dashboard, or record and upload files. The two riddles are:
- `riddle-keyboard`: "I have keys but no locks. I have space but no room. You can enter, but you can't go outside. What am I?"
- `riddle-candle`: "The more you take, the more you leave behind. What am I?"

- [ ] **Step 2: Point the bank entries at the new URLs**

In `src/content/bank.js`, for each of the two activities, replace the `src`/`captions` with the R2 URL and **delete** the `placeholder: true` line and its `TODO(teacher)` comment.

- [ ] **Step 3: Remove the stand-in files**

```bash
git rm assets/media/locker-riddle.mp4 assets/media/candle-riddle.m4a
# keep the .vtt files only if the new recordings still use those captions
```

- [ ] **Step 4: Verify**

Run: `npm test`, then play both rooms locally and confirm the clips load from R2 and no "Sample clip" note appears.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "Replace placeholder clue recordings with real ones"
git push origin main
```

---

## Verification checklist

- [ ] `npm test` green (34 existing + ~20 new)
- [ ] `wrangler deploy --dry-run` lists `env.MEDIA` and `env.MEDIA_LIMITER`
- [ ] Endpoint returns 201 / 401 / 413 / 415 / 429 correctly
- [ ] A recorded clip plays for a student from `media.mrbsocialstudies.org`
- [ ] Saving is blocked when a recording has no riddle text
- [ ] A denied camera permission falls back to the file picker
- [ ] A failed upload keeps the take and offers a retry
- [ ] No "Sample clip" notes remain
