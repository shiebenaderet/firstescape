// Visual escape builder.
// Teachers assemble an escape from an activity palette, edit each challenge with friendly
// forms, see a LIVE preview rendered by the real game engine, and publish — no code.

import { el, clear, mount } from '../../engine/dom.js';
import { fetchAdminEscapes, saveEscape, deleteEscape, fetchVisibility, setVisibility } from '../../engine/apiClient.js';
import { ACTIVITY_SCHEMAS, getSchema } from '../../activities/schemas.js';
import { getActivityType } from '../../activities/index.js';
import { getBuiltinEscapes } from '../../content/index.js';
import { gameLinkFor } from '../hub.js';

const EMOJIS = ['🚪', '🧪', '🗝️', '🔐', '🧩', '🔎', '🗺️', '⚡', '🎯', '🏆', '🚀', '🕵️', '📚', '🔬', '🎨', '🎵', '🌟', '🧠', '⏳', '🎲'];

const SAMPLE_STATE = {
  team: { period: '1', members: [{ name: 'Ava', subject: 'Math' }, { name: 'Ben', subject: 'Art' }], names: ['Ava', 'Ben'], subjects: ['Math', 'Art'], size: 2 },
  answers: {},
};

export function renderBuilder(host, { onPublished } = {}) {
  renderList(host, { onPublished });
}

function copyLink(id, btn) {
  const url = gameLinkFor(id);
  const done = (msg) => {
    const original = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = original; }, 1800);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => done('Copied!')).catch(() => window.prompt('Copy this game link:', url));
  } else {
    window.prompt('Copy this game link:', url);
  }
}

function visToggle(checked, onChange) {
  const input = el('input', { type: 'checkbox', class: 'vis-input', checked });
  const label = el('span', { class: 'vis-label' }, checked ? 'Visible' : 'Hidden');
  input.addEventListener('change', () => {
    label.textContent = input.checked ? 'Visible' : 'Hidden';
    onChange(input.checked);
  });
  return el('label', { class: 'vis-toggle', title: 'Show or hide this room on the student hub' }, [
    input,
    el('span', { class: 'vis-track' }),
    label,
  ]);
}

/* ------------------------------- list view ------------------------------ */
function renderList(host, { onPublished }) {
  mount(host, el('div', { class: 'dash-loading' }, 'Loading your rooms…'));
  Promise.all([fetchAdminEscapes(), fetchVisibility()])
    .then(([custom, hidden]) => {
      let hiddenIds = new Set(hidden || []);

      async function persistHidden() {
        await setVisibility([...hiddenIds]);
        if (onPublished) onPublished();
      }

      const builtinCards = getBuiltinEscapes().map((e) => {
        const visible = !hiddenIds.has(e.id);
        return el('div', { class: 'builder-card' }, [
          el('div', { class: 'builder-card-icon' }, e.icon || '🚪'),
          el('div', { class: 'builder-card-body' }, [
            el('div', { class: 'builder-card-title' }, e.title),
            el('div', { class: 'builder-card-meta' }, [
              el('span', { class: 'pill pill-built' }, 'Built-in'),
              el('span', {}, `${(e.activities || []).length} challenges`),
            ]),
          ]),
          el('div', { class: 'builder-card-actions' }, [
            visToggle(visible, (on) => {
              if (on) hiddenIds.delete(e.id);
              else hiddenIds.add(e.id);
              persistHidden().catch((err) => alert(err.message));
            }),
            el('button', { class: 'btn btn-ghost', on: { click: (ev) => copyLink(e.id, ev.currentTarget) } }, 'Copy link'),
          ]),
        ]);
      });

      const customCards = custom.map((e) =>
        el('div', { class: 'builder-card' }, [
          el('div', { class: 'builder-card-icon' }, (e.definition && e.definition.icon) || '🚪'),
          el('div', { class: 'builder-card-body' }, [
            el('div', { class: 'builder-card-title' }, e.title),
            el('div', { class: 'builder-card-meta' }, [
              el('span', { class: `pill ${e.published ? 'pill-on' : 'pill-off'}` }, e.published ? 'Published' : 'Draft'),
              el('span', {}, `${(e.definition && e.definition.activities || []).length} challenges`),
            ]),
          ]),
          el('div', { class: 'builder-card-actions' }, [
            visToggle(!!e.published, (on) => {
              saveEscape(e.id, { title: e.title, definition: e.definition, published: on })
                .then(() => { if (onPublished) onPublished(); })
                .catch((err) => alert(err.message));
            }),
            el('button', { class: 'btn btn-ghost', on: { click: (ev) => copyLink(e.id, ev.currentTarget) } }, 'Copy link'),
            el('button', { class: 'btn btn-primary', on: { click: () => openEditor(host, e.definition, { onPublished, isNew: false }) } }, 'Edit'),
            el('button', { class: 'btn btn-ghost danger', on: { click: () => remove(e.id) } }, 'Delete'),
          ]),
        ])
      );

      function remove(id) {
        if (!confirm('Delete this escape? This cannot be undone.')) return;
        deleteEscape(id).then(() => renderList(host, { onPublished })).catch((err) => alert(err.message));
      }

      mount(host, el('div', { class: 'dash-panel' }, [
        el('div', { class: 'builder-list-head' }, [
          el('h2', {}, 'Rooms'),
          el('button', { class: 'btn btn-primary', on: { click: () => openEditor(host, newEscape(), { onPublished, isNew: true }) } }, '＋ New escape'),
        ]),
        el('p', { class: 'muted' }, 'Toggle which rooms students see on the hub. Hidden rooms stay off the hub (direct links still work).'),
        el('h3', { class: 'builder-section-title' }, 'Built-in rooms'),
        el('div', { class: 'builder-list' }, builtinCards),
        el('h3', { class: 'builder-section-title' }, 'Your rooms'),
        customCards.length
          ? el('div', { class: 'builder-list' }, customCards)
          : el('p', { class: 'results-empty' }, 'No custom rooms yet. Click “New escape” to build one.'),
      ]));
    })
    .catch((err) => mount(host, el('div', { class: 'dash-error' }, [
      el('p', {}, `Couldn't load rooms: ${err.message}`),
      el('button', { class: 'btn btn-ghost', on: { click: () => renderList(host, { onPublished }) } }, 'Retry'),
    ])));
}

function newEscape() {
  return {
    id: '', title: '', icon: '🚪', estimatedMinutes: 15, gradeBand: '', summary: '', intro: '',
    structure: 'linear', activities: [], victory: { title: 'You escaped!', message: '', accomplishments: [] },
    published: false,
  };
}

/* ------------------------------ editor view ----------------------------- */
function openEditor(host, source, { onPublished, isNew }) {
  const escape = JSON.parse(JSON.stringify(source));
  if (!escape.victory) escape.victory = { title: 'You escaped!', message: '', accomplishments: [] };
  if (!Array.isArray(escape.victory.accomplishments)) escape.victory.accomplishments = [];
  if (!Array.isArray(escape.activities)) escape.activities = [];
  let selected = escape.activities.length ? 0 : -1;
  let showPalette = escape.activities.length === 0;

  const editorHost = el('div', { class: 'builder-editor' });
  mount(host, editorHost);

  function renderEditor() {
    const list = escape.activities.map((a, i) => challengeRow(a, i));

    const leftCol = el('div', { class: 'builder-left' }, [
      el('button', { class: 'link-btn', on: { click: () => renderList(host, { onPublished }) } }, '← All escapes'),
      el('h2', { class: 'builder-h2' }, isNew ? 'New escape' : 'Edit escape'),
      metaForm(),
      el('div', { class: 'builder-section-title' }, 'Challenges'),
      list.length ? el('div', { class: 'challenge-list' }, list) : el('p', { class: 'muted' }, 'No challenges yet — add one from the palette →'),
      el('button', { class: 'btn btn-ghost', on: { click: () => { showPalette = true; renderEditor(); } } }, '＋ Add challenge'),
      el('div', { class: 'builder-section-title' }, 'Victory screen'),
      victoryForm(),
      el('div', { class: 'builder-save-row' }, [
        publishToggle(),
        el('button', { class: 'btn btn-primary', on: { click: save } }, '💾 Save'),
      ]),
      saveMsg,
    ]);

    const rightCol = el('div', { class: 'builder-right' },
      showPalette
        ? [palette()]
        : selected >= 0 && escape.activities[selected]
          ? [challengeEditor(escape.activities[selected], selected), previewPane(escape.activities[selected])]
          : [el('div', { class: 'builder-empty' }, 'Select a challenge to edit, or add one.')]
    );

    clear(editorHost);
    editorHost.append(leftCol, rightCol);
  }

  const saveMsg = el('div', { class: 'message', hidden: true });

  /* ---- meta ---- */
  function metaForm() {
    return el('div', { class: 'form-grid' }, [
      textField('Title', escape.title, (v) => { escape.title = v; if (isNew && !escape._idEdited) escape.id = slugify(v); }),
      el('div', { class: 'field-row' }, [
        el('label', { class: 'field-label' }, 'Icon'),
        emojiPicker(escape.icon, (v) => { escape.icon = v; }),
      ]),
      numberField('Estimated minutes', escape.estimatedMinutes, (v) => { escape.estimatedMinutes = v; }),
      textField('Grade band (optional)', escape.gradeBand, (v) => { escape.gradeBand = v; }),
      selectField('How students move through it', [
        { value: 'linear', label: 'One at a time, in order (recommended)' },
        { value: 'non-linear', label: 'All puzzles at once, any order' },
      ], escape.structure || 'linear', (v) => { escape.structure = v; }),
      textareaField('Short summary (shown on the hub card)', escape.summary, (v) => { escape.summary = v; }),
      textareaField('Intro (shown when the escape starts)', escape.intro, (v) => { escape.intro = v; }),
    ]);
  }

  function victoryForm() {
    return el('div', { class: 'form-grid' }, [
      textField('Victory title', escape.victory.title, (v) => { escape.victory.title = v; }),
      textareaField('Victory message', escape.victory.message, (v) => { escape.victory.message = v; }),
      stringListField('Accomplishments (bullet list)', escape.victory.accomplishments),
    ]);
  }

  function publishToggle() {
    const cb = el('input', { type: 'checkbox', checked: !!escape.published });
    cb.addEventListener('change', () => { escape.published = cb.checked; });
    return el('label', { class: 'publish-toggle' }, [cb, ' Published (visible to students)']);
  }

  /* ---- challenge list rows ---- */
  function challengeRow(a, i) {
    const schema = getSchema(a.type);
    return el('div', { class: 'challenge-row' + (i === selected && !showPalette ? ' active' : '') }, [
      el('button', { class: 'challenge-main', on: { click: () => { selected = i; showPalette = false; renderEditor(); } } }, [
        el('span', { class: 'challenge-icon' }, a.icon || (schema && schema.icon) || '🧩'),
        el('span', { class: 'challenge-titles' }, [
          el('span', { class: 'challenge-title' }, a.title || '(untitled)'),
          el('span', { class: 'challenge-type' }, schema ? schema.label : a.type),
        ]),
      ]),
      el('div', { class: 'challenge-ctrls' }, [
        el('button', { class: 'icon-btn', title: 'Move up', disabled: i === 0, on: { click: () => move(i, -1) } }, '↑'),
        el('button', { class: 'icon-btn', title: 'Move down', disabled: i === escape.activities.length - 1, on: { click: () => move(i, 1) } }, '↓'),
        el('button', { class: 'icon-btn danger', title: 'Remove', on: { click: () => removeChallenge(i) } }, '✕'),
      ]),
    ]);
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= escape.activities.length) return;
    const [item] = escape.activities.splice(i, 1);
    escape.activities.splice(j, 0, item);
    selected = j;
    renderEditor();
  }
  function removeChallenge(i) {
    escape.activities.splice(i, 1);
    if (selected >= escape.activities.length) selected = escape.activities.length - 1;
    if (escape.activities.length === 0) showPalette = true;
    renderEditor();
  }

  /* ---- palette ---- */
  function palette() {
    return el('div', { class: 'palette' }, [
      el('div', { class: 'palette-head' }, [
        el('h3', {}, 'Pick a challenge type'),
        escape.activities.length ? el('button', { class: 'link-btn', on: { click: () => { showPalette = false; renderEditor(); } } }, 'Cancel') : null,
      ]),
      el('div', { class: 'palette-grid' }, ACTIVITY_SCHEMAS.map((s) =>
        el('button', { class: 'palette-tile', on: { click: () => addChallenge(s.type) } }, [
          el('span', { class: 'palette-icon' }, s.icon),
          el('span', { class: 'palette-label' }, s.label),
          el('span', { class: 'palette-desc' }, s.description),
        ])
      )),
    ]);
  }

  function addChallenge(type) {
    const schema = getSchema(type);
    const a = {
      id: `c${Date.now().toString(36)}`,
      type,
      icon: schema ? schema.icon : '🧩',
      title: schema ? schema.label : type,
      story: '',
      hints: [],
      config: schema && schema.defaults ? schema.defaults() : {},
    };
    escape.activities.push(a);
    selected = escape.activities.length - 1;
    showPalette = false;
    renderEditor();
  }

  /* ---- challenge editor ---- */
  function challengeEditor(a, i) {
    const schema = getSchema(a.type);
    const fields = [
      el('div', { class: 'field-row' }, [
        el('label', { class: 'field-label' }, 'Icon'),
        emojiPicker(a.icon, (v) => { a.icon = v; refreshPreview(a); }),
      ]),
      textField('Challenge title', a.title, (v) => { a.title = v; refreshPreviewTitle(); }),
      textareaField('Story / setup (optional)', a.story, (v) => { a.story = v; }),
    ];

    for (const f of (schema ? schema.fields : [])) {
      fields.push(renderConfigField(a, f));
    }
    if (!Array.isArray(a.hints)) a.hints = [];
    fields.push(stringListField('Hints (optional)', a.hints));

    return el('div', { class: 'challenge-editor' }, [
      el('div', { class: 'challenge-editor-head' }, [
        el('span', { class: 'challenge-icon' }, a.icon || '🧩'),
        el('h3', {}, `Challenge ${i + 1}: ${schema ? schema.label : a.type}`),
      ]),
      el('div', { class: 'form-grid' }, fields),
    ]);
  }

  function renderConfigField(a, f) {
    const cfg = a.config || (a.config = {});
    if (f.kind === 'text') return textField(f.label, cfg[f.key], (v) => { cfg[f.key] = v; refreshPreview(a); }, f.placeholder);
    if (f.kind === 'textarea') return textareaField(f.label, cfg[f.key], (v) => { cfg[f.key] = v; refreshPreview(a); }, f.placeholder);
    if (f.kind === 'number') return numberField(f.label, cfg[f.key], (v) => { cfg[f.key] = v; refreshPreview(a); });
    if (f.kind === 'select') return selectField(f.label, f.options, cfg[f.key], (v) => { cfg[f.key] = v; refreshPreview(a); });
    if (f.kind === 'stringlist') { if (!Array.isArray(cfg[f.key])) cfg[f.key] = []; return stringListField(f.label, cfg[f.key], f.placeholder); }
    if (f.kind === 'options') return optionsField(cfg, () => renderEditor(), () => refreshPreview(a));
    if (f.kind === 'pads') return padsField(cfg, () => renderEditor(), () => refreshPreview(a));
    return null;
  }

  /* ---- live preview ---- */
  let previewHostRef = null;
  function previewPane(a) {
    previewHostRef = el('div', { class: 'preview-host' });
    const pane = el('div', { class: 'preview-pane' }, [
      el('div', { class: 'preview-tag' }, '👀 Live preview — how students see this challenge'),
      previewHostRef,
    ]);
    renderPreviewInto(previewHostRef, a);
    return pane;
  }
  function refreshPreview(a) {
    if (previewHostRef) renderPreviewInto(previewHostRef, a);
  }
  function refreshPreviewTitle() { if (selected >= 0) refreshPreview(escape.activities[selected]); }

  function renderPreviewInto(hostEl, a) {
    clear(hostEl);
    const card = el('div', { class: 'puzzle-card' }, [
      a.title ? el('h2', { class: 'puzzle-title' }, a.icon ? `${a.icon} ${a.title}` : a.title) : null,
      a.story ? el('div', { class: 'puzzle-story' }, a.story) : null,
    ]);
    const body = el('div', { class: 'activity-host' });
    const msg = el('div', { class: 'message', hidden: true });
    card.append(body, msg);
    hostEl.appendChild(card);

    const type = getActivityType(a.type);
    if (!type) { body.appendChild(el('p', {}, `(Preview unavailable for "${a.type}")`)); return; }
    const stub = {
      activity: a,
      getState: () => SAMPLE_STATE,
      patchState() {},
      setAnswer() {},
      getAnswer() { return undefined; },
      success(m) { showMsg('success', m); },
      error(m) { showMsg('error', m); },
      solve() { showMsg('success', '✓ Solved (preview)'); },
    };
    function showMsg(kind, m) { msg.className = `message ${kind}`; msg.textContent = m; msg.hidden = false; }
    try {
      type.mount(body, stub);
    } catch (err) {
      body.appendChild(el('p', {}, `(Preview error: ${err.message})`));
    }
  }

  /* ---- save ---- */
  async function save() {
    if (!escape.title.trim()) { showSave('error', 'Please give your escape a title.'); return; }
    if (!escape.id) escape.id = slugify(escape.title);
    if (!escape.activities.length) { showSave('error', 'Add at least one challenge.'); return; }
    showSave('info', 'Saving…');
    try {
      await saveEscape(escape.id, { title: escape.title, definition: escape, published: escape.published });
      showSave('success', escape.published ? '✅ Saved & published! It\'s live on the hub.' : '✅ Saved as draft.');
      if (onPublished) onPublished();
    } catch (err) {
      showSave('error', err.message || 'Save failed.');
    }
  }
  function showSave(kind, m) {
    saveMsg.className = `message ${kind === 'info' ? '' : kind}`;
    saveMsg.textContent = m;
    saveMsg.hidden = false;
  }

  // All declarations are ready — do the initial render now.
  renderEditor();
}

/* ---------------------------- field helpers ----------------------------- */
function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'escape';
}
function labelWrap(label, control) {
  return el('div', { class: 'field-row' }, [el('label', { class: 'field-label' }, label), control]);
}
function textField(label, value, onInput, placeholder) {
  const i = el('input', { type: 'text', class: 'field', value: value || '', placeholder: placeholder || '' });
  i.addEventListener('input', () => onInput(i.value));
  return labelWrap(label, i);
}
function textareaField(label, value, onInput, placeholder) {
  const t = el('textarea', { class: 'field', rows: 2, placeholder: placeholder || '' }, value || '');
  t.addEventListener('input', () => onInput(t.value));
  return labelWrap(label, t);
}
function numberField(label, value, onInput) {
  const i = el('input', { type: 'number', class: 'field', value: value == null ? '' : value });
  i.addEventListener('input', () => onInput(i.value === '' ? undefined : Number(i.value)));
  return labelWrap(label, i);
}
function selectField(label, options, value, onInput) {
  const s = el('select', { class: 'field' }, options.map((o) => el('option', { value: o.value, selected: o.value === value }, o.label)));
  s.addEventListener('change', () => onInput(s.value));
  return labelWrap(label, s);
}
// Edits mutate the passed model array in place (so Save always has the latest values).
// Add/remove only redraws this list's rows, preserving focus elsewhere in the editor.
function stringListField(label, arr, placeholder) {
  const rows = el('div', { class: 'stringlist' });
  function draw() {
    clear(rows);
    arr.forEach((val, idx) => {
      const i = el('input', { type: 'text', class: 'field', value: val, placeholder: placeholder || '' });
      i.addEventListener('input', () => { arr[idx] = i.value; });
      rows.appendChild(el('div', { class: 'stringlist-row' }, [
        i,
        el('button', { class: 'icon-btn danger', type: 'button', title: 'Remove', on: { click: () => { arr.splice(idx, 1); draw(); } } }, '✕'),
      ]));
    });
    rows.appendChild(el('button', { class: 'link-btn', type: 'button', on: { click: () => { arr.push(''); draw(); } } }, '＋ Add'));
  }
  draw();
  return labelWrap(label, rows);
}
function optionsField(cfg, rerender, refresh) {
  if (!Array.isArray(cfg.options)) cfg.options = [{ id: 'a', label: '' }];
  const rows = cfg.options.map((opt, idx) => {
    const radio = el('input', { type: 'radio', name: 'correct-opt', checked: cfg.correct === opt.id });
    radio.addEventListener('change', () => { cfg.correct = opt.id; });
    const text = el('input', { type: 'text', class: 'field', value: opt.label, placeholder: `Choice ${idx + 1}` });
    text.addEventListener('input', () => { opt.label = text.value; refresh && refresh(); });
    return el('div', { class: 'option-row' }, [
      radio,
      text,
      el('button', { class: 'icon-btn danger', title: 'Remove', on: { click: () => { cfg.options.splice(idx, 1); rerender(); } } }, '✕'),
    ]);
  });
  const add = el('button', { class: 'link-btn', on: { click: () => { const id = Math.random().toString(36).slice(2, 6); cfg.options.push({ id, label: '' }); rerender(); } } }, '＋ Add choice');
  return labelWrap('Choices (select the correct one)', el('div', { class: 'options-editor' }, [...rows, add]));
}

// Pads + the secret order, for the `sequence` activity. Teachers name each pad and set its
// tone, then click pads in order to record the answer — much clearer than typing pad ids.
function padsField(cfg, rerender, refresh) {
  if (!Array.isArray(cfg.pads)) cfg.pads = [];
  if (!Array.isArray(cfg.answer)) cfg.answer = [];

  const padRows = cfg.pads.map((pad, idx) => {
    const label = el('input', { type: 'text', class: 'field', value: pad.label || '', placeholder: `Pad ${idx + 1} name` });
    label.addEventListener('input', () => { pad.label = label.value; refresh && refresh(); });
    const freq = el('input', { type: 'number', class: 'field', value: pad.freq == null ? '' : pad.freq, placeholder: 'Tone Hz' });
    freq.addEventListener('input', () => { pad.freq = freq.value === '' ? undefined : Number(freq.value); refresh && refresh(); });
    return el('div', { class: 'option-row' }, [
      label,
      freq,
      el('button', {
        class: 'icon-btn danger', title: 'Remove pad', type: 'button',
        on: {
          click: () => {
            cfg.pads.splice(idx, 1);
            cfg.answer = cfg.answer.filter((id) => id !== pad.id); // drop it from the order too
            rerender();
          },
        },
      }, '✕'),
    ]);
  });

  const addPad = el('button', {
    class: 'link-btn', type: 'button',
    on: {
      click: () => {
        const id = `p${Math.random().toString(36).slice(2, 6)}`;
        cfg.pads.push({ id, label: '', freq: 330 });
        rerender();
      },
    },
  }, '＋ Add pad');

  // The answer: click pads in order to build the sequence.
  const answerPreview = el('div', { class: 'seq-answer-preview' });
  function drawAnswer() {
    answerPreview.textContent = cfg.answer.length
      ? cfg.answer.map((id) => (cfg.pads.find((p) => p.id === id) || {}).label || '?').join('  →  ')
      : 'No sequence set yet — click pads below in the order students must press them.';
  }
  drawAnswer();

  const pickers = cfg.pads.map((pad) =>
    el('button', {
      class: 'btn btn-ghost seq-pick', type: 'button',
      on: { click: () => { cfg.answer.push(pad.id); drawAnswer(); refresh && refresh(); } },
    }, pad.label || '(unnamed)')
  );

  const clearAnswer = el('button', {
    class: 'link-btn', type: 'button',
    on: { click: () => { cfg.answer.length = 0; drawAnswer(); refresh && refresh(); } },
  }, 'Clear sequence');

  return labelWrap('Pads and secret order', el('div', { class: 'options-editor' }, [
    el('p', { class: 'muted' }, 'Name each pad and give it a tone (Hz). Higher numbers sound higher.'),
    ...padRows,
    addPad,
    el('div', { class: 'builder-section-title' }, 'Secret order'),
    answerPreview,
    el('div', { class: 'seq-pick-row' }, pickers),
    clearAnswer,
  ]));
}

/* ---- emoji picker ---- */
function emojiPicker(current, onPick) {
  const btn = el('button', { class: 'emoji-current', type: 'button' }, current || '🚪');
  const grid = el('div', { class: 'emoji-grid', hidden: true }, EMOJIS.map((e) =>
    el('button', {
      class: 'emoji-opt',
      type: 'button',
      on: {
        click: () => {
          btn.textContent = e;       // reflect the choice immediately
          grid.hidden = true;        // close the popup (the reported bug)
          onPick(e);                 // update the model
        },
      },
    }, e)
  ));
  btn.addEventListener('click', () => { grid.hidden = !grid.hidden; });
  return el('div', { class: 'emoji-picker' }, [btn, grid]);
}
