// Teacher results view: centralized completions from every device/class, with summary
// tiles, an escape filter, a table, and CSV/JSON export.

import { el, clear, mount } from '../../engine/dom.js';
import { fetchAllResults } from '../../engine/apiClient.js';
import { toCSV, downloadFile } from '../../engine/results.js';

export function renderTeacherResults(host) {
  mount(host, el('div', { class: 'dash-loading' }, 'Loading results…'));

  fetchAllResults()
    .then((rows) => renderLoaded(host, rows))
    .catch((err) => {
      mount(host, el('div', { class: 'dash-error' }, [
        el('p', {}, `Couldn't load results: ${err.message}`),
        el('button', { class: 'btn btn-ghost', on: { click: () => renderTeacherResults(host) } }, 'Retry'),
      ]));
    });
}

function renderLoaded(host, allRows) {
  let currentEscape = '';

  const escapeOptions = [...new Set(allRows.map((r) => r.escape_id))].sort();

  const summary = el('div', { class: 'stat-tiles' });
  const tableWrap = el('div', { class: 'results-table-wrap' });

  const filter = el('select', { class: 'field', style: { maxWidth: '260px' } }, [
    el('option', { value: '' }, `All escapes (${allRows.length})`),
    ...escapeOptions.map((id) => {
      const count = allRows.filter((r) => r.escape_id === id).length;
      const title = (allRows.find((r) => r.escape_id === id) || {}).escape_title || id;
      return el('option', { value: id }, `${title} (${count})`);
    }),
  ]);
  filter.addEventListener('change', () => { currentEscape = filter.value; update(); });

  function rows() {
    return currentEscape ? allRows.filter((r) => r.escape_id === currentEscape) : allRows;
  }

  function update() {
    const list = rows();

    // Summary tiles
    clear(summary);
    const periods = new Set(list.map((r) => r.period).filter(Boolean));
    const escapes = new Set(list.map((r) => r.escape_id));
    summary.append(
      tile('✅', list.length, 'Completions'),
      tile('🧩', escapes.size, 'Escapes played'),
      tile('🏫', periods.size, 'Class periods'),
      tile('🕐', fastestTime(list), 'Fastest time'),
    );

    // Table
    clear(tableWrap);
    if (!list.length) {
      tableWrap.appendChild(el('p', { class: 'results-empty' }, 'No completions yet. They\'ll appear here as teams finish.'));
      return;
    }
    const cols = [
      ['created_at', 'When'],
      ['escape_title', 'Escape'],
      ['period', 'Period'],
      ['team', 'Team'],
      ['completion_time', 'Time'],
    ];
    tableWrap.appendChild(el('table', { class: 'results-table' }, [
      el('thead', {}, el('tr', {}, cols.map(([, label]) => el('th', {}, label)))),
      el('tbody', {}, list.map((r) => el('tr', {}, cols.map(([k]) => el('td', {}, r[k] == null ? '' : String(r[k])))))),
    ]));
  }

  function exportRows(kind) {
    const list = rows().map((r) => ({
      when: r.created_at, escape: r.escape_title, period: r.period, team: r.team, time: r.completion_time,
    }));
    if (!list.length) return;
    const base = currentEscape || 'all-escapes';
    if (kind === 'csv') downloadFile(`${base}-results.csv`, toCSV(list), 'text/csv');
    else downloadFile(`${base}-results.json`, JSON.stringify(list, null, 2), 'application/json');
  }

  mount(host, el('div', { class: 'dash-panel' }, [
    summary,
    el('div', { class: 'results-toolbar' }, [
      el('label', { class: 'toolbar-label' }, 'Show:'),
      filter,
      el('div', { class: 'results-toolbar-actions' }, [
        el('button', { class: 'btn btn-ghost', on: { click: () => exportRows('csv') } }, '⬇ CSV'),
        el('button', { class: 'btn btn-ghost', on: { click: () => exportRows('json') } }, '⬇ JSON'),
        el('button', { class: 'btn btn-ghost', on: { click: () => renderTeacherResults(host) } }, '↻ Refresh'),
      ]),
    ]),
    tableWrap,
  ]));

  update();
}

function tile(icon, value, label) {
  return el('div', { class: 'stat-tile' }, [
    el('div', { class: 'stat-icon' }, icon),
    el('div', { class: 'stat-value' }, String(value)),
    el('div', { class: 'stat-label' }, label),
  ]);
}

function fastestTime(list) {
  const times = list.map((r) => r.completion_time).filter(Boolean);
  if (!times.length) return '—';
  const toSec = (t) => {
    const m = /^(\d+):(\d+)$/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : Infinity;
  };
  return times.reduce((best, t) => (toSec(t) < toSec(best) ? t : best));
}
