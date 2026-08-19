// App entry point + hash router.
// Routes:
//   #/                      -> hub (catalog of escapes)
//   #/escape/<escapeId>     -> run a specific escape

import { listEscapes, getEscape, getBank } from './content/index.js';
import { renderHub } from './views/hub.js';
import { renderResults } from './views/results.js';
import { startEscape } from './engine/engine.js';
import { el, clear } from './engine/dom.js';

const root = document.getElementById('app');

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

  renderHub(root, listEscapes(), {
    onLaunch: (id) => go(`#/escape/${encodeURIComponent(id)}`),
    onResults: (id) => go(`#/results/${encodeURIComponent(id)}`),
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

window.addEventListener('hashchange', render);
render();
