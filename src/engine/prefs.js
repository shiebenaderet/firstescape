// Small accessibility preferences persisted across visits.
// Currently: a "bigger text" toggle that scales the whole app (all sizes use rem).

const KEY = 'escape-hub:v1:prefs';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function isLargeText() {
  return !!read().largeText;
}

/** Apply saved preferences to the document root. Call once on boot. */
export function applyPrefs() {
  document.documentElement.classList.toggle('text-large', isLargeText());
}

/** Toggle the large-text preference; returns the new state. */
export function toggleLargeText() {
  const prefs = read();
  prefs.largeText = !prefs.largeText;
  write(prefs);
  applyPrefs();
  return prefs.largeText;
}
