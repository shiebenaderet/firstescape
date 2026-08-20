// Runtime configuration.
//
// API_BASE points at the Cloudflare Worker (results collection, teacher auth, custom escapes).
// The production URL is public and safe to ship.
//
// When the app is served from localhost, it automatically talks to a local Worker
// (`npm run dev` in server/) instead of production — so poking around in development never
// writes real completions into the live database. Override either side with:
//
//   localStorage.setItem('escape-hub:v1:api-base', 'https://…')   // force a specific API
//   localStorage.setItem('escape-hub:v1:api-base', '')            // force offline mode
//   localStorage.removeItem('escape-hub:v1:api-base')             // back to automatic
//
// Set PRODUCTION_API to '' to disable the backend everywhere (offline-only build).

const PRODUCTION_API = 'https://escape-hub-api.shiebenaderet.workers.dev';
const LOCAL_API = 'http://127.0.0.1:8788';

const OVERRIDE_KEY = 'escape-hub:v1:api-base';

function resolveApiBase() {
  // An explicit override always wins, including an intentional '' for offline testing.
  try {
    const override = localStorage.getItem(OVERRIDE_KEY);
    if (override !== null) return override;
  } catch {
    /* storage blocked (private mode / embedded) — fall through to the default */
  }

  // `location` is absent outside a browser (e.g. the Node test runner importing a module
  // that transitively pulls this in), so treat that as "not localhost".
  const host = typeof location === 'undefined' ? '' : location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return LOCAL_API;

  return PRODUCTION_API;
}

export const API_BASE = resolveApiBase();
