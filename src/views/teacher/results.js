// Teacher results view: centralized completions from every device/class, with summary
// tiles, an escape filter, a table, expandable per-team answers, and CSV/JSON export.
//
// Each row in D1 carries the full record JSON in `data` — including every per-activity
// answer the team wrote (`answer:<activityId>` keys built by buildDefaultRecord). The table
// stays scannable, and expanding a row reveals that student work; exports include it too.

import { el, clear, mount } from '../../engine/dom.js';
import { fetchAllResults } from '../../engine/apiClient.js';
import { toCSV, downloadFile } from '../../engine/results.js';

/** Parse the stored record JSON for a row; returns {} when absent or malformed. */
function recordOf(row) {
  if (!row || !row.data) return {};
  try {
    const parsed = JSON.parse(row.data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** The per-activity answers a team wrote, as [{ label, value }] in a readable order. */
export function answersOf(row) {
  const rec = recordOf(row);
  return Object.entries(rec)
    .filter(([k]) => k.startsWith('answer:'))
    .map(([k, v]) => ({ label: prettyLabel(k.slice('answer:'.length)), value: v }))
    .filter((a) => a.value !== '' && a.value != null);
}

/** Turn an activity id like "cipher-lab-riddle-2" into "Cipher lab riddle 2". */
export function prettyLabel(id) {
  const s = String(id).replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : id;
}

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

    const body = el('tbody', {});
    for (const r of list) {
      const answers = answersOf(r);

      // Detail row holding this team's written work; toggled by the button below.
      const detail = el('tr', { class: 'results-detail-row', hidden: true }, [
        el('td', { colspan: String(cols.length + 1) }, [
          answers.length
            ? el('dl', { class: 'answer-list' }, answers.flatMap((a) => [
                el('dt', {}, a.label),
                el('dd', {}, String(a.value)),
              ]))
            : el('p', { class: 'muted' }, 'This team’s room recorded no written answers.'),
        ]),
      ]);

      const toggle = el('button', {
        class: 'link-btn',
        'aria-expanded': 'false',
        disabled: !answers.length,
        title: answers.length ? 'Show what this team wrote' : 'No written answers recorded',
      }, answers.length ? `Show answers (${answers.length})` : '—');

      toggle.addEventListener('click', () => {
        const open = detail.hidden;
        detail.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'Hide answers' : `Show answers (${answers.length})`;
      });

      body.append(
        el('tr', {}, [
          ...cols.map(([k]) => el('td', {}, r[k] == null ? '' : String(r[k]))),
          el('td', {}, toggle),
        ]),
        detail
      );
    }

    tableWrap.appendChild(el('table', { class: 'results-table' }, [
      el('thead', {}, el('tr', {}, [
        ...cols.map(([, label]) => el('th', {}, label)),
        el('th', {}, 'Answers'),
      ])),
      body,
    ]));
  }

  // Exports carry the written answers too — toCSV unions keys across rows, so teams that
  // played different rooms still line up into one sheet (blank where a column doesn't apply).
  function exportRows(kind) {
    const list = rows().map((r) => {
      const flat = {
        when: r.created_at,
        escape: r.escape_title,
        period: r.period,
        team: r.team,
        time: r.completion_time,
      };
      for (const a of answersOf(r)) flat[a.label] = a.value;
      return flat;
    });
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

export function fastestTime(list) {
  const times = list.map((r) => r.completion_time).filter(Boolean);
  if (!times.length) return '—';
  const toSec = (t) => {
    const m = /^(\d+):(\d+)$/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : Infinity;
  };
  return times.reduce((best, t) => (toSec(t) < toSec(best) ? t : best));
}
