// Activity type: broken (internal)
// Placeholder rendered when a challenge can't be resolved — an unknown bank id, a malformed
// entry, or an activity type this build doesn't know about. It exists so one bad entry in a
// definition degrades to a single skippable card instead of throwing and blanking the room.
//
// Teams can move past it, so a typo never traps a class mid-period. The detail line is aimed
// at the teacher (who can fix it in the builder), not the students.
//
// Config: { detail?: string }

import { el } from '../engine/dom.js';

export default {
  type: 'broken',
  label: 'Broken challenge (placeholder)',

  mount(host, api) {
    const cfg = api.activity.config || {};

    host.appendChild(el('div', { class: 'activity-body' }, [
      el('p', { class: 'prompt' }, 'Something is wrong with this challenge, so your team can skip it.'),
      el('p', { class: 'muted' }, 'Let your teacher know — everything else in this room still works.'),
      cfg.detail ? el('p', { class: 'broken-detail' }, cfg.detail) : null,
      el('button', {
        class: 'btn btn-primary',
        on: {
          click: () => {
            api.setAnswer({ skipped: true, reason: cfg.detail || 'unresolved activity' });
            api.success('Skipped — on to the next challenge.');
            api.solve();
          },
        },
      }, 'Skip this challenge →'),
    ]));
  },
};
