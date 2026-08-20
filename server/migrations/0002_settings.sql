-- Key/value settings. Used to store which built-in rooms the teacher has hidden
-- from the student hub (custom rooms use the `escapes.published` flag instead).
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
