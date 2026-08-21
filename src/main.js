// App entry point + hash router.
//   #/                    -> hub (catalog of escapes)
//   #/escape/<escapeId>   -> run a specific escape
//   #/results/<escapeId>  -> quick per-escape results (local device)
//   #/teacher             -> teacher dashboard (login → results + escape builder)

import { listVisibleEscapes, getEscape, getBank, registerCustomEscapes, setHiddenEscapes, setMediaOverrideMap } from './content/index.js';
import { renderHub } from './views/hub.js';
import { renderResults } from './views/results.js';
import { renderTeacher } from './views/teacher/index.js';
import { startEscape } from './engine/engine.js';
import { applyPrefs } from './engine/prefs.js';
import { fetchPublishedEscapes, fetchVisibility, fetchMediaOverrides, apiEnabled } from './engine/apiClient.js';
import { el, clear } from './engine/dom.js';

const root = document.getElementById('app');
applyPrefs();

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function render() {
  const hash = location.hash || '#/';
  window.scrollTo(0, 0);

  const escapeMatch = hash.match(/^#\/escape\/(.+)$/);
  if (escapeMatch) {
    const escape = getEscape(decodeURIComponent(escapeMatch[1]));
    if (!escape) return renderNotFound();
    startEscape(root, escape, getBank(), { onExit: () => go('#/') });
    return;
  }

  const resultsMatch = hash.match(/^#\/results\/(.+)$/);
  if (resultsMatch) {
    const escape = getEscape(decodeURIComponent(resultsMatch[1]));
    if (!escape) return renderNotFound();
    renderResults(root, escape, { onBack: () => go('#/') });
    return;
  }

  if (hash === '#/teacher' || hash.startsWith('#/teacher/')) {
    renderTeacher(root, { onExit: () => go('#/'), onRefresh: loadCustomEscapes });
    return;
  }

  renderHub(root, listVisibleEscapes(), {
    onLaunch: (id) => go(`#/escape/${encodeURIComponent(id)}`),
    onTeacher: () => go('#/teacher'),
  });
}

function renderNotFound() {
  clear(root);
  root.appendChild(el('div', { class: 'hub' }, [
    el('div', { class: 'not-found' }, [
      el('h1', {}, 'Escape not found'),
      el('button', { class: 'btn btn-primary', on: { click: () => go('#/') } }, '← Back to the Hub'),
    ]),
  ]));
}

async function loadCustomEscapes() {
  if (!apiEnabled()) return;
  try {
    const [list, hidden, overrides] = await Promise.all([
      fetchPublishedEscapes(),
      fetchVisibility(),
      fetchMediaOverrides(),
    ]);
    registerCustomEscapes(list.map((e) => e.definition).filter(Boolean));
    setHiddenEscapes(hidden);
    setMediaOverrideMap(overrides);
  } catch {
    /* offline / API down: just show built-in escapes */
  }
}

window.addEventListener('hashchange', render);

// Load published custom escapes first (so the hub shows them), then render.
loadCustomEscapes().finally(render);
