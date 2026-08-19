// Activity type: team-responses
// Collects one open-ended response per team member (or a fixed number of responses).
// Reads the roster from shared state when available (falls back to a fixed count).
//
// Config:
// {
//   prompt: string,
//   placeholder?: (member, index) => string  OR  string
//   minLength?: number,        // default 10
//   fallbackCount?: number,    // used when no team roster in state (default 3)
//   successMessage?: string
// }

import { el } from '../engine/dom.js';

export default {
  type: 'team-responses',
  label: 'Per-member open responses',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const minLength = cfg.minLength ?? 10;
    const team = api.getState().team;
    const members = team && team.members && team.members.length
      ? team.members
      : Array.from({ length: cfg.fallbackCount ?? 3 }, (_, i) => ({ name: `Team member ${i + 1}` }));

    const saved = api.getAnswer() || [];

    const areas = members.map((member, i) => {
      const placeholder = typeof cfg.placeholder === 'function'
        ? cfg.placeholder(member, i)
        : (cfg.placeholder || `${member.name}: share your response`);
      return el('textarea', {
        class: 'field',
        rows: 3,
        placeholder,
        value: saved[i] || '',
      });
    });

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      ...areas.map((area, i) =>
        el('div', { class: 'response-row' }, [
          el('span', { class: 'response-name' }, members[i].name),
          area,
        ])
      ),
      el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Submit Responses'),
    ]));

    function submit() {
      const values = areas.map((a) => a.value.trim());
      if (values.some((v) => v.length < minLength)) {
        api.error(`Make sure everyone shares at least a full sentence (${minLength}+ characters).`);
        return;
      }
      api.setAnswer(values);
      api.success(cfg.successMessage || 'Thank you for sharing — the path forward is revealed!');
      api.solve();
    }
  },
};
