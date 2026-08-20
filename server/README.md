# Escape Hub API (Cloudflare Worker + D1)

The backend for the Classroom Escape Hub: centralized results collection, teacher login, and
teacher-authored custom escapes. Runs on Cloudflare's free tier (Workers + D1).

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Health check |
| GET | `/api/escapes` | — | Published custom escapes (for the hub) |
| POST | `/api/results` | — | Submit a completion (`{ escapeId, record }`) |
| POST | `/api/login` | — | Teacher login (`{ password }`) → `{ token }` |
| GET | `/api/admin/results[?escapeId=]` | Bearer | All completions (newest first) |
| DELETE | `/api/admin/results/:id` | Bearer | Delete a completion |
| GET | `/api/admin/escapes` | Bearer | All escapes (incl. drafts) |
| PUT | `/api/admin/escapes/:id` | Bearer | Create/update an escape |
| DELETE | `/api/admin/escapes/:id` | Bearer | Delete an escape |

Secrets: `TEACHER_PASSWORD` (login passphrase), `AUTH_SECRET` (HMAC key for session tokens).

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

# 4. Deploy
npm run deploy
```

After deploy, note the Worker URL (e.g. `https://escape-hub-api.<subdomain>.workers.dev`, or a
custom route like `https://api.mrbsocialstudies.org`) and set it as the frontend's API base URL.

Update `vars.ALLOWED_ORIGINS` in `wrangler.jsonc` to include the site origin(s) allowed to call the API.
