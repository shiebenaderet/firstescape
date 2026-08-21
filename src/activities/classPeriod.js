// Activity type: class-period
// A single dropdown asking which class period the team is in — and nothing else.
//
// Why this exists separately from team-setup: a roster is 5-7 inputs, and putting it before
// the first puzzle means a student's first experience of an "escape room" is filling in a
// form. This asks the one field the teacher genuinely needs up front (so results can be
// grouped by period even if a team quits partway), gets them into a puzzle in about five
// seconds, and leaves the full roster for `team-setup` after the first success.
//
// It writes the same `state.team.period` that team-setup does, and team-setup preserves it,
// so ordering the two is a content decision rather than a code change.
//
// Config:
// {
//   periods?: string[]     // default ['1','2','3','4','5','6']
//   prompt?: string        // label above the dropdown
// }

import { el } from '../engine/dom.js';

export default {
  type: 'class-period',
  label: 'Class period (quick start)',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const periods = cfg.periods || ['1', '2', '3', '4', '5', '6'];
    const state = api.getState();
    const saved = (state.team && state.team.period) || api.getAnswer() || '';

    const select = el('select', { class: 'field', 'aria-label': 'Class period' }, [
      el('option', { value: '', disabled: true, selected: !saved }, 'Pick your class period…'),
      ...periods.map((p) => el('option', { value: p, selected: saved === p }, `Period ${p}`)),
    ]);

    function submit() {
      if (!select.value) {
        api.error('Pick your class period to start.');
        return;
      }
      api.setAnswer(select.value);
      // Merge rather than replace: a resumed game may already have a roster.
      api.patchState({ team: { ...(api.getState().team || {}), period: select.value } });
      api.success('You\'re in. Good luck!');
      api.solve();
    }

    // Choosing from the dropdown is the whole task, so let that submit directly —
    // one tap instead of two.
    select.addEventListener('change', () => { if (select.value) submit(); });

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      select,
      el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Start →'),
    ]));
  },
};
