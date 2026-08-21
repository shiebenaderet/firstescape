# Teacher Recording Flow — Design

**Date:** 2026-08-20
**Status:** Approved, not yet implemented
**Depends on:** R2 enabled on the Cloudflare account (blocking — see Prerequisites)

## Problem

Activities can already carry a `media` clue — video or audio, with on-screen text and optional
captions — and the student-side player (`src/views/media.js`) renders it correctly today. But
there is no way for a teacher to *create* one. The two clips in `assets/media/` are
ffmpeg-generated placeholders committed to git, currently flagged `placeholder: true` so
students see a "Sample clip" note instead of pressing play on silence.

A teacher who wants to record themselves reading a riddle has no path that does not involve
recording on a phone, transferring the file to a laptop, adding it to the repo, and pushing to
GitHub. This is the highest-value missing feature.

## Goals

- A teacher records a video or audio clue **in the dashboard**, previews it, retakes if needed,
  and attaches it to a challenge — without leaving the browser.
- A teacher who already recorded elsewhere can upload a file instead.
- Students stream the clip quickly and reliably, with no per-play cost or rate limit.
- A clue is **never** the only way to solve a puzzle.

## Non-goals (v1)

- Automatic caption generation (speech-to-text). Deferred; `media.captions` stays supported for
  hand-written WebVTT.
- A media library for reusing one clip across many challenges. Recordings belong to a challenge.
- Deleting orphaned files. Uploads are write-only in v1; see Cleanup.
- Trimming, filters, or any editing.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Serving | R2 custom domain (`media.mrbsocialstudies.org`) | Files come straight from Cloudflare's CDN. No Worker in the read path, so 30 students pressing play at once costs nothing and cannot be rate-limited. `r2.dev` is explicitly documented as non-production and rate-limited. |
| Capture | MediaRecorder + file-picker fallback | Removes the record-elsewhere-and-transfer friction that motivates the feature. The picker covers unsupported browsers and hardware problems. |
| Riddle text | **Required** when a recording exists | Makes the clue safe for a deaf student, a broken speaker, or silent reading. The player already always renders `media.text`. |
| Cleanup | Leave orphans; add a tool later | Nothing can delete a file a live escape still points at. At ~20 MB/clip it takes hundreds of orphans to matter against 10 GB. |
| UI placement | "Clue recording" section in the challenge editor | Media attaches to an activity, so it belongs with the other per-challenge fields. The live preview picks it up for free. |
| Upload cap | 40 MB | A 2-minute 720p clip is 15–25 MB. Well under the 100 MB Workers request-body limit, and one mis-click cannot eat a meaningful slice of the free tier. |

## Architecture

```
Dashboard (builder)                Worker                     R2 bucket           Student
──────────────────                 ──────                     ─────────           ───────
recorder.js                        POST /api/admin/media  →   escape-hub-media
  MediaRecorder capture      ──→     requireAuth (Bearer)       clues/<id>.webm
  preview / retake                   rate limit 5/min
  or file picker                     validate type + size
                                     stream body → R2
                                       ↓
                                   { url, key, type, bytes }
                                       ↓
                             activity.media = { type, src, text, label }
                                       ↓
                                 D1 (escape definition JSON)
                                       ↓
                     https://media.mrbsocialstudies.org/clues/<id>.webm
                                       ↓
                              renderMedia()  ← unchanged
```

The read path contains no Worker. The write path is authenticated and rate-limited.

`src/views/media.js` requires **no changes**: it already treats `media.src` as an opaque URL, so
an absolute R2 URL works exactly like today's relative `assets/media/...` path.

## Components

### 1. Upload endpoint — `server/src/index.js`

```
POST /api/admin/media?type=video|audio
  Authorization: Bearer <teacher token>
  Content-Type:  video/webm | video/mp4 | audio/webm | audio/mpeg | audio/mp4
  Body:          raw bytes

201 { url, key, type, bytes }
401 not authenticated       413 file too large
415 unsupported type        429 rate limited
```

Order of operations — cheapest rejection first:

1. `requireAuth()` — reuses the existing teacher token. No new auth concept.
2. Rate limit `MEDIA_LIMITER` (5/min per IP), same `isRateLimited` helper as the other endpoints.
3. `Content-Type` against the allowlist → 415.
4. `Content-Length` against 40 MB → 413, **before** reading the body.
5. `env.MEDIA.put(key, request.body)` — streams. Workers cap memory at 128 MB; buffering a
   40 MB file via `arrayBuffer()` would work but wastes memory for no benefit.

**Key generation is server-side:** `clues/<crypto.randomUUID()>.<ext>`, extension derived from
the validated content type. The client never supplies a path, so it cannot overwrite another
object or escape the `clues/` prefix.

**`Content-Length` can be absent** on a chunked request. Treat missing as unknown and reject
(413) rather than streaming an unbounded body — the dashboard always sends a `Blob`, which
always sets the header.

### 2. Recorder UI — `src/views/teacher/recorder.js` (new)

A collapsed **Clue recording** section in the challenge editor. State machine:

```
idle ──[Record video]──→ recording ──[Stop]──→ review ──[Use this]──→ uploading ──→ saved
 │                            │                   │                       │
 │                            └──[Cancel]─────────┴──[Retake]─────────────┘
 └──[Upload a file]──→ review
```

- Nothing hits the network until **Use this** — a retake is purely local.
- Live camera preview while recording video; an elapsed-time counter for both.
- `saved` shows playback, size, and **Replace** / **Remove**.
- `Remove` clears `activity.media` locally; the R2 object is intentionally left in place.

**Recording format:** whatever the browser natively produces — `video/webm` on
Chrome/Edge/Firefox/ChromeOS, `video/mp4` on Safari. Both are in the allowlist and play
everywhere that matters. Chosen via `MediaRecorder.isTypeSupported()` rather than forcing a
container.

**Degradation:** no `MediaRecorder`, no `getUserMedia`, or a denied permission → the section
falls back to the file picker with an explanatory message. Never a dead end.

### 3. Configuration — `server/wrangler.jsonc`

```jsonc
"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "escape-hub-media" }],
"ratelimits": [ /* existing two */, {
  "name": "MEDIA_LIMITER", "namespace_id": "1003",
  "simple": { "limit": 5, "period": 60 }
}]
```

Plus a non-secret var `MEDIA_BASE_URL` (`https://media.mrbsocialstudies.org`) so the Worker can
return absolute URLs without hardcoding the domain in code.

## Data model

`activity.media` is unchanged in shape. A recorded clue is:

```js
media: {
  type: 'video',
  src: 'https://media.mrbsocialstudies.org/clues/3f9a....webm',
  text: 'I have keys but no locks…',   // REQUIRED when src is set
  label: 'Mr. B reads the riddle',
}
```

This is JSON-safe, so it round-trips through D1 like the rest of a custom escape — no functions,
consistent with the constraint that keeps `computed-lock` out of the builder.

## Error handling

| Failure | Behavior |
| --- | --- |
| Camera/mic permission denied | Explain, offer the file picker. Not a dead end. |
| Upload fails (network, 5xx) | Keep the local blob; show Retry. The recording is never lost to a failed upload. |
| 413 / 415 | Specific message ("that clip is 62 MB — the limit is 40 MB; try audio or a shorter take"), not a generic error. |
| 429 | "Too many uploads, wait a minute." |
| Session expired mid-upload (401) | Prompt re-login; keep the blob so it can be retried after. |
| R2 object missing at play time | Player already degrades: the text clue always renders. |

## Testing

| Layer | Method |
| --- | --- |
| Key generation, extension mapping, size/type validation | Pure functions in `test/media.test.js`, Node's built-in runner — same no-dependency pattern as the existing 34 tests |
| Upload endpoint | `wrangler dev --local`; R2 has a local simulator, so real PUTs with no cloud calls. Cover 201 / 401 / 413 / 415 / 429. |
| Recorder state machine | Extracted as a pure reducer so transitions are testable without a browser |
| MediaRecorder capture | Manual — record a real clip, play it back, verify it reaches R2 |

The existing `hidden`/`display` CSS guard automatically covers any new toggled elements.

## Prerequisites (blocking, owner-only)

1. **Enable R2** — `dash.cloudflare.com` → R2 → Enable. Requires a payment method. Free tier is
   10 GB storage and 1M writes/month; realistic usage here is a few hundred MB.
   Verified blocked on 2026-08-20: `403 code 10042 "Please enable R2 through the Cloudflare Dashboard."`
2. **Confirm the media subdomain** — `media.mrbsocialstudies.org` proposed. The zone is already
   on Cloudflare, so connecting it to the bucket is a dashboard step.

Once R2 is enabled, bucket creation and the binding can be done with wrangler. Connecting the
custom domain is a dashboard action.

## Rollout

1. Enable R2, create the bucket, connect the custom domain.
2. Ship the Worker endpoint. Verify with curl against local, then production.
3. Ship the recorder UI behind normal use — no flag needed; the section simply appears.
4. Record the two real clips for `riddle-keyboard` and `riddle-candle`, then delete the
   `placeholder: true` flags and the ffmpeg stand-ins from `assets/media/`.

## Future work

- Orphan cleanup: a dashboard tool listing R2 objects no escape references.
- Auto-captions via Workers AI, with a teacher review step.
- Reusing one clip across challenges (media library).
