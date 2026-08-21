// "Clue recordings" panel for BUILT-IN challenges.
//
// Built-in escapes live in git as JS modules, so the visual builder — which saves escape
// definitions to D1 — has no row to write to and deliberately offers no Edit button for them.
// That left the two placeholder clips unreachable.
//
// This panel closes that gap without making built-ins editable: it lists every built-in
// challenge that carries a media clue, lets the teacher record or upload a replacement, and
// stores the result as an activityId -> media patch map in D1 (the same settings mechanism
// used for hub visibility). `mediaFor()` in content/index.js applies it at play time.

import { el, clear, mount } from '../../engine/dom.js';
import { fetchMediaOverrides, setMediaOverrides } from '../../engine/apiClient.js';
import { getBuiltinEscapes, getBank } from '../../content/index.js';
import { renderRecorder } from './recorder.js';

/**
 * Every built-in challenge that carries a media clue, with the escape it belongs to.
 * Bank entries are resolved so shared activities (referenced by id) are included.
 */
export function builtinMediaActivities() {
  const bank = getBank();
  const seen = new Set();
  const out = [];

  for (const escape of getBuiltinEscapes()) {
    for (const entry of escape.activities || []) {
      const activity = typeof entry === 'string' ? bank[entry] : entry;
      if (!activity || !activity.media || !activity.media.src) continue;
      if (!activity.id || seen.has(activity.id)) continue;
      seen.add(activity.id);
      out.push({ activity, escapeTitle: escape.title, escapeIcon: escape.icon });
    }
  }
  return out;
}

export function renderBuiltinMedia(host) {
  mount(host, el('div', { class: 'dash-loading' }, 'Loading clue recordings…'));

  fetchMediaOverrides()
    .then((overrides) => draw(host, overrides || {}))
    .catch((err) => mount(host, el('div', { class: 'dash-error' }, [
      el('p', {}, `Couldn't load recordings: ${err.message}`),
      el('button', { class: 'btn btn-ghost', on: { click: () => renderBuiltinMedia(host) } }, 'Retry'),
    ])));
}

function draw(host, overrides) {
  const items = builtinMediaActivities();
  const working = { ...overrides };
  const status = el('div', { class: 'message', hidden: true });

  async function persist() {
    status.className = 'message';
    status.textContent = 'Saving…';
    status.hidden = false;
    try {
      await setMediaOverrides(working);
      status.className = 'message success';
      status.textContent = '✅ Saved. Students will hear the new recording.';
    } catch (err) {
      status.className = 'message error';
      status.textContent = err.message || 'Could not save.';
    }
  }

  const cards = items.map(({ activity, escapeTitle, escapeIcon }) => {
    const override = working[activity.id];
    const isPlaceholder = !override && activity.media.placeholder;

    // The recorder mutates a shadow activity so the built-in module is never touched.
    // Its media starts from the current override, or the built-in's own clip.
    const shadow = {
      id: activity.id,
      media: override
        ? { ...activity.media, ...override, placeholder: undefined }
        : { ...activity.media },
    };

    return el('div', { class: 'builtin-media-card' }, [
      el('div', { class: 'builtin-media-head' }, [
        el('span', { class: 'challenge-icon' }, activity.icon || '🎙️'),
        el('div', {}, [
          el('div', { class: 'builder-card-title' }, activity.title || activity.id),
          el('div', { class: 'builder-card-meta' }, [
            el('span', {}, `${escapeIcon ? escapeIcon + ' ' : ''}${escapeTitle}`),
            isPlaceholder
              ? el('span', { class: 'pill pill-off' }, 'Sample clip')
              : el('span', { class: 'pill pill-on' }, override ? 'Your recording' : 'Built-in clip'),
          ]),
        ]),
      ]),
      el('p', { class: 'muted builtin-media-riddle' }, activity.media.text || ''),
      renderRecorder(shadow, () => {
        if (shadow.media && shadow.media.src) {
          working[activity.id] = {
            src: shadow.media.src,
            type: shadow.media.type,
            // Keep the built-in riddle text; it already matches the words being read.
            text: shadow.media.text || activity.media.text || '',
            label: shadow.media.label || activity.media.label || '',
          };
        } else {
          delete working[activity.id];
        }
        persist();
      }),
    ]);
  });

  mount(host, el('div', { class: 'dash-panel' }, [
    el('h2', {}, 'Clue recordings'),
    el('p', { class: 'muted' },
      'Record your own voice for the built-in challenges. These rooms are part of the app itself, '
      + 'so only their clips can be changed here — everything else about them stays fixed.'),
    status,
    cards.length
      ? el('div', { class: 'builtin-media-list' }, cards)
      : el('p', { class: 'results-empty' }, 'No built-in challenges have clue recordings.'),
  ]));
}
