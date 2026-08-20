// Runtime configuration.
//
// API_BASE points at the deployed Cloudflare Worker (results collection, teacher auth,
// custom escapes). It's a public URL, safe to ship. Set to '' to disable the backend and
// run fully offline (results then save locally only, and no custom escapes/dashboard).

export const API_BASE = 'https://escape-hub-api.shiebenaderet.workers.dev';
