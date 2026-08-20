-- Classroom Escape Hub — initial schema

-- Completions recorded when a team finishes an escape (submitted from any device).
CREATE TABLE IF NOT EXISTS completions (
  id              TEXT PRIMARY KEY,
  escape_id       TEXT NOT NULL,
  escape_title    TEXT,
  period          TEXT,
  team            TEXT,
  completion_time TEXT,
  data            TEXT,                      -- full JSON record (flexible columns)
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_completions_escape ON completions (escape_id, created_at DESC);

-- Custom escapes authored in the teacher dashboard. `definition` is the full escape JSON
-- (the same shape as the code-defined escapes: title, activities, victory, etc.).
CREATE TABLE IF NOT EXISTS escapes (
  id          TEXT PRIMARY KEY,             -- slug used in the URL (#/escape/<id>)
  title       TEXT NOT NULL,
  definition  TEXT NOT NULL,
  published   INTEGER NOT NULL DEFAULT 0,   -- 0 = draft, 1 = published (visible to students)
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
