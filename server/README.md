# Escape Hub API (Cloudflare Worker + D1)

The backend for the Classroom Escape Hub: centralized results collection, teacher login,
teacher-authored custom escapes, and clue-recording storage. Runs on Cloudflare's free tier
(Workers + D1 + R2).

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Health check |
| GET | `/api/escapes` | — | Published custom escapes (for the hub) |
| GET | `/api/visibility` | — | Built-in escape ids hidden from the hub |
| POST | `/api/results` | — | Submit a completion (`{ escapeId, record }`) |
| POST | `/api/login` | — | Teacher login (`{ password }`) → `{ token }` |
| GET | `/api/admin/results[?escapeId=]` | Bearer | All completions (newest first) |
| DELETE | `/api/admin/results/:id` | Bearer | Delete a completion |
| PUT | `/api/admin/visibility` | Bearer | Set hidden built-in escapes |
| GET | `/api/admin/escapes` | Bearer | All escapes (incl. drafts) |
| PUT | `/api/admin/escapes/:id` | Bearer | Create/update an escape |
| DELETE | `/api/admin/escapes/:id` | Bearer | Delete an escape |
| POST | `/api/admin/media?type=video\|audio` | Bearer | Upload a clue recording → `{ url, key, type, bytes }` |

Secrets: `TEACHER_PASSWORD` (login passphrase), `AUTH_SECRET` (HMAC key for session tokens).

## Rate limits

Per client IP, configured in `wrangler.jsonc`. Over the limit returns `429`.

| Endpoint | Limit |
| --- | --- |
| `POST /api/results` | 10 / min |
| `POST /api/login` | 5 / min |
| `POST /api/admin/media` | 5 / min |

Counters are per edge location rather than global, so these are abuse brakes — they stop
scripted junk and password guessing — not hard quotas. The helper fails **open**: if a binding
is missing, requests are allowed rather than blocking a class mid-period.

## Media storage (R2)

Clue recordings live in the `escape-hub-media` bucket under `clues/<uuid>.<ext>`.

- **Keys are generated server-side**, so a client can never choose its own path or overwrite
  another object. Unique keys make objects immutable, hence a one-year `immutable` cache header.
- **Uploads are validated from headers before the body is read** — type against an allowlist
  (`video/webm`, `video/mp4`, `audio/webm`, `audio/mpeg`, `audio/mp4`) and size against a 40 MB
  cap. The body is then streamed straight to R2; Workers cap memory at 128 MB, so files are
  never buffered.
- **Reads do not go through the Worker.** The bucket is served publicly from
  `media.mrbsocialstudies.org` (`MEDIA_BASE_URL`), so students fetch clips from Cloudflare's
  CDN — no per-play Worker cost and no rate limit.
- **Uploads are write-only.** Replacing or removing a recording leaves the old object in place,
  because another draft may still reference it. Orphans are cheap (~20 MB against a 10 GB free
  tier); a cleanup tool is future work.

URLs are unguessable but **public** — anyone with the link can fetch the clip. That is fine for
a teacher reading a riddle. If recordings ever contain student voices, switch to signed URLs.

## Local development

```bash
cd server
npm install
cp .dev.vars.example .dev.vars        # then edit the values
npm run migrate:local                  # apply D1 schema to a local database
npm run dev                            # wrangler dev on http://127.0.0.1:8787
```

## Deploy to Cloudflare (one-time setup)

```bash
cd server
npx wrangler login                     # or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID

# 1. Create the D1 database and paste its id into wrangler.jsonc (d1_databases[0].database_id)
npx wrangler d1 create escape_hub

# 2. Apply the schema to the remote database
npm run migrate:remote

# 3. Set secrets
npx wrangler secret put TEACHER_PASSWORD
npx wrangler secret put AUTH_SECRET     # a long random string

# 4. Create the media bucket (requires R2 enabled on the account, via the dashboard)
npx wrangler r2 bucket create escape-hub-media

# 5. Deploy
npm run deploy
```

Then connect the bucket to a public domain — this step is **dashboard-only**, there is no
wrangler equivalent:

> **R2** → **escape-hub-media** → **Settings** → **Custom Domains** → **Add** →
> `media.mrbsocialstudies.org` → **Connect Domain**

Status goes from *Initializing* to *Active* in a couple of minutes, and Cloudflare creates the
DNS record automatically. Keep the `r2.dev` **Public Development URL disabled** — Cloudflare
rate-limits it and documents it as unsuitable for production.

Set `vars.MEDIA_BASE_URL` in `wrangler.jsonc` to whatever domain you connected.

Verify the whole path end to end:

```bash
# write an object, fetch it over the public domain, then clean up
echo hello > /tmp/probe.txt
npx wrangler r2 object put escape-hub-media/clues/_probe.txt --file /tmp/probe.txt \
  --content-type text/plain --remote
curl -s https://media.mrbsocialstudies.org/clues/_probe.txt     # expect: hello
npx wrangler r2 object delete escape-hub-media/clues/_probe.txt --remote
```

After deploy, note the Worker URL (e.g. `https://escape-hub-api.<subdomain>.workers.dev`, or a
custom route like `https://api.mrbsocialstudies.org`) and set it as the frontend's API base URL.

Update `vars.ALLOWED_ORIGINS` in `wrangler.jsonc` to include the site origin(s) allowed to call the API.
