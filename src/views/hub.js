// Hub landing view: the catalog of available escapes. Teachers browse the bank of escapes
// here and launch one for the class.

import { el, clear } from '../engine/dom.js';
import { loadProgress } from '../engine/storage.js';
import { loadCompletions } from '../engine/results.js';
import { isLargeText, toggleLargeText } from '../engine/prefs.js';

const MASCOT_SVG = `
<svg viewBox="0 0 96 96" role="img" aria-label="Escape Hub key mascot">
  <rect x="3" y="3" width="90" height="90" rx="24" fill="#f0533f"/>
  <g transform="rotate(45 48 48)">
    <circle cx="48" cy="30" r="14" fill="none" stroke="#fff" stroke-width="7"/>
    <circle cx="48" cy="30" r="4.5" fill="#fff"/>
    <rect x="44" y="41" width="8" height="34" rx="4" fill="#fff"/>
    <rect x="52" y="58" width="13" height="7" rx="3.5" fill="#ffd23f"/>
    <rect x="52" y="67" width="9" height="7" rx="3.5" fill="#ffd23f"/>
  </g>
</svg>`;

/** Build a shareable direct link to a specific escape (works on any host / custom domain). */
export function gameLinkFor(escapeId) {
  return `${location.origin}${location.pathname}#/escape/${encodeURIComponent(escapeId)}`;
}

function copyGameLink(escapeId, btn) {
  const url = gameLinkFor(escapeId);
  const done = (msg) => {
    const original = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = original; }, 2200);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => done('✅ Link copied!')).catch(() => window.prompt('Copy this game link:', url));
  } else {
    window.prompt('Copy this game link:', url);
  }
}

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
        el('span', { class: 'teacher-label' }, '👩‍🏫 Teacher'),
        el('button', {
          class: 'link-btn',
          title: 'Copy a direct link to this game to share with your class',
          on: { click: (e) => copyGameLink(escape.id, e.currentTarget) },
        }, '🔗 Copy game link'),
        el('span', { class: 'dot-sep' }, '·'),
        el('button', {
          class: 'link-btn',
          on: { click: () => onResults(escape.id) },
        }, `📊 Results${completions ? ` (${completions})` : ''}`),
      ]),
    ]);
  });

  const textBtn = el('button', {
    class: 'btn btn-ghost',
    'aria-pressed': String(isLargeText()),
    on: {
      click: () => {
        const on = toggleLargeText();
        textBtn.setAttribute('aria-pressed', String(on));
        textBtn.textContent = on ? 'Aa Normal text' : 'Aa Bigger text';
      },
    },
  }, isLargeText() ? 'Aa Normal text' : 'Aa Bigger text');

  const view = el('div', { class: 'hub' }, [
    el('header', { class: 'hub-header' }, [
      el('div', { class: 'hub-brand' }, [
        el('div', { class: 'hub-logo', html: MASCOT_SVG }),
        el('div', {}, [
          el('h1', { class: 'hub-title' }, [el('span', { class: 'accent' }, 'Escape'), ' Hub']),
          el('p', { class: 'hub-tagline' }, 'Grab your team, put your heads together, and escape the room — one puzzle at a time.'),
        ]),
      ]),
      el('div', { class: 'settings' }, [textBtn]),
    ]),
    el('div', { class: 'hub-grid' }, cards),
    el('footer', { class: 'hub-footer' }, [
      el('p', {}, `${escapes.length} escape${escapes.length === 1 ? '' : 's'} ready to play · new ones added through the year`),
    ]),
  ]);

  clear(root);
  root.appendChild(view);
}
