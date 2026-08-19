// Hub landing view: the catalog of available escapes. Teachers browse the bank of escapes
// here and launch one for the class.

import { el, clear } from '../engine/dom.js';
import { loadProgress } from '../engine/storage.js';
import { loadCompletions } from '../engine/results.js';

export function renderHub(root, escapes, { onLaunch, onResults }) {
  const cards = escapes.map((escape) => {
    const inProgress = loadProgress(escape.id);
    const started = inProgress && inProgress.index > 0 && inProgress.index < (escape.activities || []).length;
    const completions = loadCompletions(escape.id).length;
    const structure = escape.structure === 'non-linear' ? 'Non-linear' : 'Linear';

    return el('article', { class: 'escape-card' }, [
      el('div', { class: 'escape-card-top' }, [
        el('span', { class: 'escape-icon' }, escape.icon || '🚪'),
        el('div', { class: 'escape-badges' }, [
          el('span', { class: 'badge badge-time' }, `⏱ ~${escape.estimatedMinutes || '?'} min`),
          el('span', { class: `badge badge-structure ${escape.structure === 'non-linear' ? 'nonlinear' : ''}` }, structure),
          escape.gradeBand ? el('span', { class: 'badge' }, escape.gradeBand) : null,
        ]),
      ]),
      el('h2', { class: 'escape-title' }, escape.title),
      escape.subtitle ? el('p', { class: 'escape-subtitle' }, escape.subtitle) : null,
      escape.format ? el('p', { class: 'escape-format' }, escape.format) : null,
      el('p', { class: 'escape-summary' }, escape.summary || ''),
      el('div', { class: 'escape-tags' }, (escape.tags || []).map((t) => el('span', { class: 'tag' }, `#${t}`))),
      el('div', { class: 'escape-actions' }, [
        el('button', {
          class: 'btn btn-primary',
          on: { click: () => onLaunch(escape.id) },
        }, started ? 'Resume escape →' : 'Start escape →'),
        el('span', { class: 'activity-count' }, `${(escape.activities || []).length} challenges`),
      ]),
      el('div', { class: 'escape-teacher' }, [
        el('button', {
          class: 'link-btn',
          on: { click: () => onResults(escape.id) },
        }, `📊 Results${completions ? ` (${completions})` : ''}`),
      ]),
    ]);
  });

  const view = el('div', { class: 'hub' }, [
    el('header', { class: 'hub-header' }, [
      el('div', { class: 'hub-brand' }, [
        el('span', { class: 'hub-logo' }, '🗝️'),
        el('div', {}, [
          el('h1', { class: 'hub-title' }, 'Classroom Escape Hub'),
          el('p', { class: 'hub-tagline' }, 'A growing bank of team escapes — mix, match, and escape together.'),
        ]),
      ]),
    ]),
    el('div', { class: 'hub-grid' }, cards),
    el('footer', { class: 'hub-footer' }, [
      el('p', {}, `${escapes.length} escape${escapes.length === 1 ? '' : 's'} available · more added throughout the year`),
    ]),
  ]);

  clear(root);
  root.appendChild(view);
}
