// Pluggable results system (replaces the old hard-coded Google Form).
//
// When a team finishes an escape, the engine builds a result "record" and hands it to one or
// more result "sinks". This is fully extensible: add a sink to SINKS and any escape can use it.
//
// Built-in sinks:
//   'local'       -> save to this browser's localStorage; view/export from the teacher dashboard (default)
//   'webhook'     -> POST JSON to a URL you control (Google Apps Script, Formspree, a serverless fn, …)
//   'google-form' -> legacy: post to a Google Form via a hidden iframe (kept for backward compatibility)
//
// Escape `results` config (all optional):
//   {
//     sinks: ['local'],                        // which sinks run automatically on completion
//     buildRecord: (state, meta) => ({...}),   // custom flat record (columns); default builder used otherwise
//     webhook: { url: 'https://…' },
//     googleForm: { action: 'https://…/formResponse', buildFields: (state, meta) => ({ 'entry.1': '…' }) }
//   }
// If an escape has no `results`, it defaults to saving locally.

import { el } from './dom.js';
import { API_BASE } from '../config.js';

const RESULTS_PREFIX = 'escape-hub:v1:results:';

/* -------------------------- local storage of results -------------------------- */

export function loadCompletions(escapeId) {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_PREFIX + escapeId) || '[]');
  } catch {
    return [];
  }
}

export function saveCompletion(escapeId, record) {
  try {
    const all = loadCompletions(escapeId);
    all.push(record);
    localStorage.setItem(RESULTS_PREFIX + escapeId, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function clearCompletions(escapeId) {
  try {
    localStorage.removeItem(RESULTS_PREFIX + escapeId);
  } catch {
    /* ignore */
  }
}

/* -------------------------------- record builder ------------------------------ */

export function buildDefaultRecord(escape, state, meta) {
  const team = state.team || {};
  const members = (team.members || [])
    .map((m) => (m.subject ? `${m.name} (${m.subject})` : m.name))
    .join('; ');

  // Include any per-activity answers as readable detail columns.
  const details = {};
  for (const [id, value] of Object.entries(state.answers || {})) {
    if (id.endsWith('-team')) continue; // roster already captured above
    details[id] = Array.isArray(value)
      ? value.join(' | ')
      : typeof value === 'object'
        ? JSON.stringify(value)
        : value;
  }

  return {
    timestamp: new Date().toISOString(),
    escapeId: escape.id,
    escape: escape.title,
    period: team.period || '',
    teamSize: team.size || (team.names || []).length || '',
    team: members,
    completionTime: meta.completionTime,
    ...flattenDetails(details),
  };
}

function flattenDetails(details) {
  const out = {};
  for (const [k, v] of Object.entries(details)) out[`answer:${k}`] = v;
  return out;
}

/* ----------------------------------- CSV utils -------------------------------- */

export function toCSV(records) {
  if (!records.length) return '';
  const columns = [];
  for (const r of records) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
  const escape = (val) => {
    const s = val == null ? '' : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(',')];
  for (const r of records) lines.push(columns.map((c) => escape(r[c])).join(','));
  return lines.join('\n');
}

export function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

/* ------------------------------------ sinks ----------------------------------- */

const SINKS = {
  local(record, escape) {
    return saveCompletion(escape.id, record);
  },

  // Central collection via the Escape Hub Worker API (results from every device land in D1).
  api(record, escape) {
    if (!API_BASE) return false;
    try {
      fetch(`${API_BASE}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escapeId: escape.id, record }),
      }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  },

  webhook(record, escape) {
    const url = escape.results?.webhook?.url;
    if (!url) return false;
    try {
      // no-cors keeps it fire-and-forget; failures never block gameplay.
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  },

  'google-form'(record, escape, state, meta) {
    const cfg = escape.results?.googleForm;
    if (!cfg || !cfg.action) return false;
    let fields = {};
    try {
      fields = cfg.buildFields ? cfg.buildFields(state, meta) : {};
    } catch {
      return false;
    }
    const name = `results-sink-${Date.now()}`;
    const iframe = el('iframe', { name, style: { display: 'none' } });
    const form = el('form', { action: cfg.action, method: 'POST', target: name, style: { display: 'none' } });
    for (const [k, v] of Object.entries(fields)) {
      form.appendChild(el('input', { type: 'hidden', name: k, value: v == null ? '' : String(v) }));
    }
    document.body.append(iframe, form);
    try {
      form.submit();
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { form.remove(); iframe.remove(); }, 4000);
    }
  },
};

/**
 * Build the record and run the configured sinks.
 * @returns {{ record: object, sinkResults: Array<{sink: string, ok: boolean}> }}
 */
export function recordResults(escape, state, meta) {
  const cfg = escape.results || {};
  const record = cfg.buildRecord ? cfg.buildRecord(state, meta) : buildDefaultRecord(escape, state, meta);
  const sinks = cfg.sinks && cfg.sinks.length ? [...cfg.sinks] : ['local'];
  // Centralize to the backend by default (so a teacher sees results from every device),
  // unless the escape explicitly opts out with `results.central: false`.
  if (API_BASE && cfg.central !== false && !sinks.includes('api')) sinks.push('api');

  const sinkResults = sinks.map((sink) => {
    const fn = SINKS[sink];
    let ok = false;
    if (fn) {
      try {
        ok = !!fn(record, escape, state, meta);
      } catch (err) {
        console.warn(`results sink "${sink}" failed`, err);
      }
    } else {
      console.warn(`Unknown results sink: "${sink}"`);
    }
    return { sink, ok };
  });

  return { record, sinkResults };
}
