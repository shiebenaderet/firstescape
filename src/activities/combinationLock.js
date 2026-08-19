// Activity type: combination-lock
// An interactive digital lock: several dials the team rolls up/down to a target combination.
// A "tech-integrated" puzzle element.
//
// Config:
// {
//   prompt?: string,
//   combination: string | number,   // target, e.g. '427' (each character is one dial)
//   min?: number,                    // min digit per dial (default 0)
//   max?: number,                    // max digit per dial (default 9)
//   successMessage?: string,
//   wrongMessage?: string
// }

import { el } from '../engine/dom.js';

export default {
  type: 'combination-lock',
  label: 'Combination lock',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const target = String(cfg.combination);
    const digits = target.length;
    const min = cfg.min ?? 0;
    const max = cfg.max ?? 9;

    const saved = api.getAnswer();
    const values = saved && saved.length === digits
      ? saved.slice()
      : Array.from({ length: digits }, () => min);

    const displays = [];

    function roll(i, delta) {
      let v = values[i] + delta;
      if (v > max) v = min;
      if (v < min) v = max;
      values[i] = v;
      displays[i].textContent = v;
    }

    const dials = Array.from({ length: digits }, (_, i) => {
      const display = el('div', { class: 'dial-display' }, String(values[i]));
      displays.push(display);
      return el('div', { class: 'dial' }, [
        el('button', { class: 'dial-btn', 'aria-label': 'increase', on: { click: () => roll(i, 1) } }, '▲'),
        display,
        el('button', { class: 'dial-btn', 'aria-label': 'decrease', on: { click: () => roll(i, -1) } }, '▼'),
      ]);
    });

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      el('div', { class: 'dials' }, dials),
      el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Try Combination'),
    ]));

    function submit() {
      api.setAnswer(values.slice());
      if (values.join('') === target) {
        api.success(cfg.successMessage || 'Click! The lock springs open.');
        api.solve();
      } else {
        api.error(cfg.wrongMessage || 'The lock holds firm. Re-check your clues and try again.');
      }
    }
  },
};
