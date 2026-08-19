// Activity type: team-setup
// Collects the class period and team roster (name + favorite subject per member).
// Writes a normalized team object into shared state that later activities can read.
//
// Config:
// {
//   periods?: string[]            // default ['1','2','4','5']
//   subjects?: string[]           // dropdown options for favorite subject
//   minMembers?: number           // default 3 (required)
//   maxMembers?: number           // default 4
//   requireUniqueNames?: boolean  // default true
// }

import { el } from '../engine/dom.js';

const DEFAULT_SUBJECTS = [
  'Math', 'Science', 'English', 'History', 'Art', 'Music',
  'Physical Education', 'Technology', 'World Language', 'Drama',
];

export default {
  type: 'team-setup',
  label: 'Team setup (roster + period)',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const periods = cfg.periods || ['1', '2', '4', '5'];
    const subjects = cfg.subjects || DEFAULT_SUBJECTS;
    const minMembers = cfg.minMembers ?? 3;
    const maxMembers = cfg.maxMembers ?? 4;
    const requireUnique = cfg.requireUniqueNames ?? true;

    const saved = api.getAnswer() || {};

    const periodSelect = el('select', { id: 'period', class: 'field' }, [
      el('option', { value: '', disabled: true, selected: !saved.period }, 'Select your class period…'),
      ...periods.map((p) =>
        el('option', { value: p, selected: saved.period === p }, `Period ${p}`)
      ),
    ]);

    const rows = [];
    for (let i = 0; i < maxMembers; i++) {
      const required = i < minMembers;
      const savedMember = (saved.members && saved.members[i]) || {};
      const nameInput = el('input', {
        type: 'text',
        class: 'field',
        placeholder: `Team member ${i + 1} name${required ? '' : ' (optional)'}`,
        value: savedMember.name || '',
      });
      const subjectSelect = el('select', { class: 'field' }, [
        el('option', { value: '', disabled: true, selected: !savedMember.subject }, 'Favorite subject…'),
        ...subjects.map((s) =>
          el('option', { value: s, selected: savedMember.subject === s }, s)
        ),
      ]);
      rows.push({ nameInput, subjectSelect, required });
    }

    const body = el('div', { class: 'activity-body' }, [
      el('label', { class: 'field-label' }, 'Class period'),
      periodSelect,
      el('label', { class: 'field-label' }, 'Your team'),
      ...rows.map((r, i) =>
        el('div', { class: 'member-row' }, [
          el('span', { class: 'member-index' }, String(i + 1)),
          r.nameInput,
          r.subjectSelect,
        ])
      ),
      el('button', {
        class: 'btn btn-primary',
        on: { click: submit },
      }, 'Submit Team Info'),
    ]);

    host.appendChild(body);

    function submit() {
      const period = periodSelect.value;
      if (!period) {
        api.error('Please select your class period first!');
        return;
      }

      const members = [];
      for (let i = 0; i < rows.length; i++) {
        const name = rows[i].nameInput.value.trim();
        const subject = rows[i].subjectSelect.value;
        if (rows[i].required) {
          if (!name || !subject) {
            api.error(`Please enter both a name and favorite subject for team member ${i + 1}.`);
            return;
          }
          members.push({ name, subject });
        } else if (name || subject) {
          if (!name || !subject) {
            api.error(`If you include team member ${i + 1}, enter both their name and favorite subject.`);
            return;
          }
          members.push({ name, subject });
        }
      }

      if (requireUnique) {
        const lower = members.map((m) => m.name.toLowerCase());
        if (new Set(lower).size !== lower.length) {
          api.error('Each team member needs a distinct name so later puzzles work correctly.');
          return;
        }
      }

      const team = {
        period,
        members,
        names: members.map((m) => m.name),
        subjects: members.map((m) => m.subject),
        size: members.length,
      };

      api.setAnswer(team);
      api.patchState({ team });
      api.success(`Welcome, ${team.names.join(', ')} from Period ${period}! The cipher is decoded.`);
      api.solve();
    }
  },
};
