// Visual escape builder.
// Teachers assemble an escape from an activity palette, edit each challenge with friendly
// forms, see a LIVE preview rendered by the real game engine, and publish — no code.

import { el, clear, mount } from '../../engine/dom.js';
import { fetchAdminEscapes, saveEscape, deleteEscape } from '../../engine/apiClient.js';
import { ACTIVITY_SCHEMAS, getSchema } from '../../activities/schemas.js';
import { getActivityType } from '../../activities/index.js';

const EMOJIS = ['🚪', '🧪', '🗝️', '🔐', '🧩', '🔎', '🗺️', '⚡', '🎯', '🏆', '🚀', '🕵️', '📚', '🔬', '🎨', '🎵', '🌟', '🧠', '⏳', '🎲'];

const SAMPLE_STATE = {
  team: { period: '1', members: [{ name: 'Ava', subject: 'Math' }, { name: 'Ben', subject: 'Art' }], names: ['Ava', 'Ben'], subjects: ['Math', 'Art'], size: 2 },
  answers: {},
};

export function renderBuilder(host, { onPublished } = {}) {
  renderList(host, { onPublished });
}

/* ------------------------------- list view ------------------------------ */
function renderList(host, { onPublished }) {
  mount(host, el('div', { class: 'dash-loading' }, 'Loading your escapes…'));
  fetchAdminEscapes()
    .then((escapes) => {
      const cards = escapes.map((e) =>
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
          el('h2', {}, 'Your escape rooms'),
          el('button', { class: 'btn btn-primary', on: { click: () => openEditor(host, newEscape(), { onPublished, isNew: true }) } }, '＋ New escape'),
        ]),
        el('p', { class: 'muted' }, 'Build and publish rooms here — published rooms appear on the student hub automatically.'),
        cards.length ? el('div', { class: 'builder-list' }, cards) : el('p', { class: 'results-empty' }, 'No custom escapes yet. Click “New escape” to build your first one!'),
      ]));
    })
    .catch((err) => mount(host, el('div', { class: 'dash-error' }, [
      el('p', {}, `Couldn't load escapes: ${err.message}`),
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
        emojiPicker(escape.icon, (v) => { escape.icon = v; renderEditor(); }),
      ]),
      numberField('Estimated minutes', escape.estimatedMinutes, (v) => { escape.estimatedMinutes = v; }),
      textField('Grade band (optional)', escape.gradeBand, (v) => { escape.gradeBand = v; }),
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
        emojiPicker(a.icon, (v) => { a.icon = v; renderEditor(); }),
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

/* ---- emoji picker ---- */
function emojiPicker(current, onPick) {
  const btn = el('button', { class: 'emoji-current', type: 'button' }, current || '🚪');
  const grid = el('div', { class: 'emoji-grid', hidden: true }, EMOJIS.map((e) =>
    el('button', { class: 'emoji-opt', type: 'button', on: { click: () => { onPick(e); } } }, e)
  ));
  btn.addEventListener('click', () => { grid.hidden = !grid.hidden; });
  return el('div', { class: 'emoji-picker' }, [btn, grid]);
}
