// Teacher Results dashboard: view every saved completion for an escape and export it.
// This replaces the Google Form: results live in the browser and export to CSV/JSON on demand.

import { el, clear } from '../engine/dom.js';
import { loadCompletions, clearCompletions, toCSV, downloadFile } from '../engine/results.js';

export function renderResults(root, escape, { onBack }) {
  let records = loadCompletions(escape.id);

  const columns = [];
  for (const r of records) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);

  const table = records.length
    ? el('div', { class: 'results-table-wrap' }, [
        el('table', { class: 'results-table' }, [
          el('thead', {}, el('tr', {}, columns.map((c) => el('th', {}, c)))),
          el('tbody', {}, records.map((r) =>
            el('tr', {}, columns.map((c) => el('td', {}, r[c] == null ? '' : String(r[c])))))),
        ]),
      ])
    : el('p', { class: 'results-empty' }, 'No completions recorded yet on this device. Results appear here after teams finish this escape.');

  const view = el('div', { class: 'hub' }, [
    el('header', { class: 'hub-header' }, [
      el('div', { class: 'hub-brand' }, [
        el('span', { class: 'hub-logo' }, '📊'),
        el('div', {}, [
          el('h1', { class: 'hub-title' }, 'Results'),
          el('p', { class: 'hub-tagline' }, escape.title),
        ]),
      ]),
    ]),
    el('div', { class: 'results-toolbar' }, [
      el('button', { class: 'btn btn-ghost', on: { click: onBack } }, '← Hub'),
      el('span', { class: 'results-count' }, `${records.length} completion${records.length === 1 ? '' : 's'}`),
      el('div', { class: 'results-toolbar-actions' }, [
        el('button', {
          class: 'btn btn-primary',
          disabled: !records.length,
          on: { click: () => downloadFile(`${escape.id}-results.csv`, toCSV(records), 'text/csv') },
        }, '⬇ Export CSV'),
        el('button', {
          class: 'btn btn-ghost',
          disabled: !records.length,
          on: { click: () => downloadFile(`${escape.id}-results.json`, JSON.stringify(records, null, 2), 'application/json') },
        }, '⬇ Export JSON'),
        el('button', {
          class: 'btn btn-ghost danger',
          disabled: !records.length,
          on: {
            click: () => {
              if (confirm('Clear ALL saved results for this escape on this device? This cannot be undone.')) {
                clearCompletions(escape.id);
                renderResults(root, escape, { onBack });
              }
            },
          },
        }, '🗑 Clear'),
      ]),
    ]),
    table,
  ]);

  clear(root);
  root.appendChild(view);
}
