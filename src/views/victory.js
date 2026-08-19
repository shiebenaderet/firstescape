// Victory / celebration screen shown when a team completes an escape.
// Content is driven by the escape's optional `victory` config. Team results can be exported
// (download / copy) here, and any auto results sinks report their status.

import { el } from '../engine/dom.js';
import { downloadFile } from '../engine/results.js';

export function renderVictory(escape, state, { completionTime, record, sinkResults = [], onExit }) {
  const v = escape.victory || {};

  const bonusButtons = (v.bonuses || []).map((bonus, i) => {
    const panel = el('div', { class: 'bonus-panel', hidden: true }, [
      bonus.title ? el('strong', {}, bonus.title) : null,
      el('p', {}, bonus.body || ''),
    ]);
    let open = false;
    const btn = el('button', {
      class: 'btn btn-assist',
      on: { click: () => { open = !open; panel.hidden = !open; } },
    }, bonus.label || `Bonus ${i + 1}`);
    return el('div', { class: 'victory-bonus' }, [btn, panel]);
  });

  const localSaved = sinkResults.some((r) => r.sink === 'local' && r.ok);
  const sinkNotes = sinkResults
    .filter((r) => r.sink !== 'local')
    .map((r) => el('span', { class: `sink-note ${r.ok ? 'ok' : 'fail'}` }, `${r.sink}: ${r.ok ? 'sent' : 'skipped'}`));

  const slug = `${escape.id}-${(record && record.timestamp) || Date.now()}`.replace(/[:.]/g, '-');

  return el('div', { class: 'victory fade-in' }, [
    el('div', { class: 'victory-badge' }, '🎉'),
    el('h2', { class: 'victory-title' }, v.title || 'You escaped!'),
    v.message ? el('p', { class: 'victory-message' }, v.message) : null,
    el('div', { class: 'victory-time' }, `🕐 Completion time: ${completionTime}`),

    Array.isArray(v.accomplishments) && v.accomplishments.length
      ? el('div', { class: 'victory-card' }, [
          el('h3', {}, 'What your team accomplished'),
          el('ul', {}, v.accomplishments.map((a) => el('li', {}, a))),
        ])
      : null,

    bonusButtons.length
      ? el('div', { class: 'victory-card' }, [
          el('h3', {}, '⭐ While other teams finish…'),
          v.bonusIntro ? el('p', {}, v.bonusIntro) : null,
          el('div', { class: 'victory-bonus-grid' }, bonusButtons),
        ])
      : null,

    record ? el('div', { class: 'victory-card' }, [
      el('h3', {}, 'Team results'),
      el('p', { class: 'results-line' }, localSaved
        ? '✅ Saved for your teacher on this device.'
        : 'Results ready — hand them in using the buttons below.'),
      sinkNotes.length ? el('div', { class: 'sink-notes' }, sinkNotes) : null,
      el('div', { class: 'results-actions' }, [
        el('button', {
          class: 'btn btn-ghost',
          on: { click: () => downloadFile(`${slug}.json`, JSON.stringify(record, null, 2), 'application/json') },
        }, '⬇ Download results (JSON)'),
        el('button', {
          class: 'btn btn-ghost',
          on: {
            click: (e) => {
              navigator.clipboard?.writeText(JSON.stringify(record, null, 2))
                .then(() => { e.target.textContent = '✓ Copied'; })
                .catch(() => { e.target.textContent = 'Copy failed'; });
            },
          },
        }, '⧉ Copy results'),
      ]),
    ]) : null,

    el('button', { class: 'btn btn-primary', on: { click: () => onExit && onExit() } }, '← Back to the Hub'),
  ]);
}
