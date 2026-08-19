// LocalStorage-backed persistence so a team can refresh / resume an in-progress escape,
// and so a teacher can reset progress between class periods.

const PREFIX = 'escape-hub:v1:';

function key(escapeId) {
  return `${PREFIX}progress:${escapeId}`;
}

export function loadProgress(escapeId) {
  try {
    const raw = localStorage.getItem(key(escapeId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProgress(escapeId, progress) {
  try {
    localStorage.setItem(key(escapeId), JSON.stringify(progress));
  } catch {
    /* storage may be unavailable (private mode); progress just won't persist */
  }
}

export function clearProgress(escapeId) {
  try {
    localStorage.removeItem(key(escapeId));
  } catch {
    /* ignore */
  }
}
