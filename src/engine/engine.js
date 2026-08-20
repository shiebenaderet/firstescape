// Core escape engine.
// Renders and drives a single escape: resolves its activities, manages shared team state,
// progression (linear OR non-linear), timer, media clues, hints/bonus, progress persistence,
// and the victory + results flow.

import { el, clear } from './dom.js';
import { getActivityType } from '../activities/index.js';
import { loadProgress, saveProgress, clearProgress } from './storage.js';
import { recordResults } from './results.js';
import { renderMedia } from '../views/media.js';
import { renderVictory } from '../views/victory.js';

const SOLVE_ADVANCE_DELAY = 1400;

/** Resolve bank id strings / inline objects into concrete activities, each with a stable id.
 *  A bad entry becomes a visible "broken challenge" placeholder rather than throwing, so one
 *  typo in a hand-edited definition can't take down the whole room mid-class. */
function resolveActivities(escape, bank) {
  return (escape.activities || []).map((entry, i) => {
    let activity;
    if (typeof entry === 'string') {
      activity = bank[entry];
      if (!activity) activity = brokenActivity(`Unknown bank activity id: "${entry}"`);
    } else if (entry && typeof entry === 'object') {
      activity = entry;
    } else {
      activity = brokenActivity(`Challenge ${i + 1} is not a valid activity.`);
    }
    if (!activity.id) activity = { ...activity, id: `${escape.id}-activity-${i}` };
    return activity;
  });
}

/** Placeholder shown in place of a challenge that couldn't be resolved. Teams can skip past it. */
function brokenActivity(detail) {
  return {
    type: 'broken',
    title: 'This challenge could not be loaded',
    icon: '⚠️',
    config: { detail },
  };
}

export function startEscape(root, escape, bank, { onExit } = {}) {
  const activities = resolveActivities(escape, bank);
  const total = activities.length;
  const nonLinear = escape.structure === 'non-linear';

  const saved = loadProgress(escape.id);
  const state = saved?.state || { team: {}, answers: {}, solved: {}, startedAt: Date.now(), escapeId: escape.id };
  if (!state.solved) state.solved = {};
  let index = Math.min(saved?.index ?? 0, total);

  function persist() {
    saveProgress(escape.id, { index, state });
  }

  function solvedCount() {
    return activities.filter((a) => state.solved[a.id]).length;
  }

  // ---- Layout scaffold -------------------------------------------------
  const timerEl = el('span', { class: 'timer' }, '00:00');
  const progressFill = el('div', { class: 'progress-fill' });
  const stepLabel = el('span', { class: 'step-label-top' }, '');
  const stage = el('div', { class: 'stage' });

  const header = el('header', { class: 'runner-header' }, [
    el('div', { class: 'runner-header-row' }, [
      el('button', { class: 'btn btn-ghost', on: { click: () => onExit && onExit() } }, '← Hub'),
      el('div', { class: 'runner-title-wrap' }, [
        el('div', { class: 'runner-eyebrow' }, [
          escape.icon ? `${escape.icon} ` : '',
          nonLinear ? 'Non-linear escape' : 'Escape in progress',
        ]),
        el('h1', { class: 'runner-title' }, escape.title),
      ]),
      el('div', { class: 'runner-meta' }, [
        timerEl,
        el('button', { class: 'btn btn-ghost', title: 'Restart from the beginning', on: { click: restart } }, '↻ Restart'),
      ]),
    ]),
    el('div', { class: 'progress-track' }, [progressFill]),
    stepLabel,
  ]);

  // Optional scene-setting text authored on the escape (builder: "Intro"). Shown while the
  // team is still at the start, then it steps out of the way so the puzzle stays the focus.
  const introEl = escape.intro
    ? el('div', { class: 'escape-intro' }, [
        el('span', { class: 'escape-intro-mark' }, '📜'),
        el('p', { class: 'escape-intro-text' }, escape.intro),
      ])
    : null;

  function updateIntro() {
    if (!introEl) return;
    const started = nonLinear ? solvedCount() > 0 : index > 0;
    introEl.hidden = started;
  }
  updateIntro();

  clear(root);
  root.appendChild(el('div', { class: 'runner' }, [header, introEl, stage].filter(Boolean)));

  // ---- Timer -----------------------------------------------------------
  const fmt = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const tick = () => { timerEl.textContent = fmt(Date.now() - (state.startedAt || Date.now())); };
  tick();
  const timerId = setInterval(tick, 1000);
  const stop = () => clearInterval(timerId);

  function updateProgress() {
    const done = nonLinear ? solvedCount() : index;
    const pct = total === 0 ? 100 : Math.round((done / total) * 100);
    progressFill.style.width = `${pct}%`;
    if (done >= total) stepLabel.textContent = 'Complete!';
    else stepLabel.textContent = nonLinear
      ? `${done} of ${total} puzzles solved — solve them in any order`
      : `Challenge ${index + 1} of ${total}`;
  }

  function restart() {
    if (!confirm('Restart this escape from the beginning? All progress for this team will be cleared.')) return;
    clearProgress(escape.id);
    stop();
    startEscape(root, escape, bank, { onExit });
  }

  // ---- Build a single activity card (shared by linear + non-linear) ----
  function buildCard(rawActivity, positionLabel, onSolve) {
    // Resolve the renderer up front. An unrecognized type falls back to the skippable
    // placeholder (so an escape authored against a newer build still plays here), and the
    // activity is rewritten to carry the reason BEFORE `api` closes over it.
    let activity = rawActivity;
    let type = getActivityType(activity.type);
    if (!type) {
      type = getActivityType('broken');
      activity = { ...activity, config: { detail: `Unknown activity type: "${activity.type}"` } };
    }

    const activityHost = el('div', { class: 'activity-host' });
    const messageEl = el('div', { class: 'message', hidden: true });
    const alreadySolved = !!state.solved[activity.id];

    let hintsRevealed = 0;
    const hintBox = el('div', { class: 'hint-box', hidden: true });
    const hints = activity.hints || [];
    const hintBtn = hints.length ? el('button', {
      class: 'btn btn-assist',
      on: {
        click: () => {
          if (hintsRevealed < hints.length) {
            hintBox.appendChild(el('p', { class: 'hint-line' }, [el('span', { class: 'hint-mark' }, '💡 '), hints[hintsRevealed]]));
            hintsRevealed++;
            hintBox.hidden = false;
          }
          if (hintsRevealed >= hints.length) { hintBtn.disabled = true; hintBtn.textContent = 'No more hints'; }
        },
      },
    }, 'Need a hint?') : null;

    let bonusOpen = false;
    const bonusPanel = activity.bonus ? el('div', { class: 'bonus-panel', hidden: true }, [
      activity.bonus.title ? el('strong', {}, activity.bonus.title) : null,
      el('p', {}, activity.bonus.body || ''),
    ]) : null;
    const bonusBtn = activity.bonus ? el('button', {
      class: 'btn btn-assist',
      on: { click: () => { bonusOpen = !bonusOpen; bonusPanel.hidden = !bonusOpen; } },
    }, '⭐ Bonus challenge') : null;

    const solvedBadge = el('div', { class: 'solved-badge', hidden: !alreadySolved }, '✓ Solved');

    const card = el('div', { class: 'puzzle-card fade-in' + (alreadySolved ? ' solved' : '') }, [
      el('div', { class: 'puzzle-eyebrow' }, positionLabel),
      el('h2', { class: 'puzzle-title' }, activity.icon ? `${activity.icon} ${activity.title}` : activity.title),
      renderMedia(activity.media),
      activity.story ? el('div', { class: 'puzzle-story' }, activity.story) : null,
      solvedBadge,
      activityHost,
      messageEl,
      el('div', { class: 'assist' }, [hintBtn, bonusBtn].filter(Boolean)),
      hintBox,
      bonusPanel,
    ]);

    function showMessage(kind, msg) {
      messageEl.className = `message ${kind}`;
      messageEl.textContent = msg;
      messageEl.hidden = false;
      if (kind === 'error') {
        clearTimeout(showMessage._t);
        showMessage._t = setTimeout(() => { messageEl.hidden = true; }, 4000);
      }
    }

    let solved = alreadySolved;
    const api = {
      activity,
      getState: () => state,
      patchState: (patch) => { Object.assign(state, patch); persist(); },
      setAnswer: (v) => { state.answers[activity.id] = v; persist(); },
      getAnswer: () => state.answers[activity.id],
      success: (msg) => showMessage('success', msg),
      error: (msg) => showMessage('error', msg),
      solve: () => {
        if (solved) return;
        solved = true;
        state.solved[activity.id] = true;
        persist();
        card.classList.add('solved');
        solvedBadge.hidden = false;
        onSolve();
      },
    };

    if (!alreadySolved) {
      type.mount(activityHost, api);
    } else {
      activityHost.appendChild(el('p', { class: 'solved-note' }, 'Your team already solved this one.'));
    }

    return card;
  }

  // ---- Linear mode -----------------------------------------------------
  function renderLinear() {
    updateProgress();
    updateIntro();
    if (index >= total) return finish();
    const activity = activities[index];
    const card = buildCard(activity, `Challenge ${index + 1} of ${total}`, () => {
      setTimeout(() => { index += 1; persist(); renderLinear(); }, SOLVE_ADVANCE_DELAY);
    });
    clear(stage);
    stage.appendChild(card);
  }

  // ---- Non-linear mode -------------------------------------------------
  function renderNonLinear() {
    updateProgress();
    updateIntro();
    if (solvedCount() >= total) return finish();
    const board = el('div', { class: 'board' },
      activities.map((activity, i) =>
        buildCard(activity, `Puzzle ${i + 1}`, () => {
          updateProgress();
          updateIntro();
          persist();
          if (solvedCount() >= total) setTimeout(finish, SOLVE_ADVANCE_DELAY);
        })
      )
    );
    clear(stage);
    stage.appendChild(el('div', { class: 'board-intro' },
      'These puzzles can be solved in any order. Solve them all to escape.'));
    stage.appendChild(board);
  }

  // ---- Victory ---------------------------------------------------------
  function finish() {
    stop();
    if (introEl) introEl.hidden = true;
    const completionTime = fmt(Date.now() - (state.startedAt || Date.now()));
    const meta = { completionTime, escapeId: escape.id, escapeTitle: escape.title };
    const { record, sinkResults } = recordResults(escape, state, meta);
    clear(stage);
    stage.appendChild(renderVictory(escape, state, { completionTime, record, sinkResults, onExit }));
    progressFill.style.width = '100%';
    stepLabel.textContent = 'Complete!';
  }

  if (nonLinear) renderNonLinear();
  else renderLinear();
}
