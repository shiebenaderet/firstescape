// Activity type: constructed-answer
// A free-writing challenge validated against a list of predicate "checks" (must contain
// all names, a subject, a keyword, minimum length, etc.). Reusable for mottos, cheers,
// story-building, exit tickets, and more.
//
// Config:
// {
//   prompt?: string,
//   requirements?: string[],     // bullet list shown to students
//   placeholder?: string,
//   minLength?: number,          // default 20
//   checks: Array<{ test: (value, state) => boolean, error: string }>,
//   successMessage?: string
// }

import { el } from '../engine/dom.js';

export default {
  type: 'constructed-answer',
  label: 'Constructed / validated writing',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const minLength = cfg.minLength ?? 20;

    const area = el('textarea', {
      class: 'field',
      rows: 4,
      placeholder: cfg.placeholder || 'Write your answer here…',
      value: api.getAnswer() || '',
    });

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      Array.isArray(cfg.requirements) && cfg.requirements.length
        ? el('ul', { class: 'requirements' }, cfg.requirements.map((r) => el('li', {}, r)))
        : null,
      area,
      el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Submit'),
    ]));

    function submit() {
      const value = area.value.trim();
      if (value.length < minLength) {
        api.error(`Your answer needs to be a bit longer (at least ${minLength} characters).`);
        return;
      }
      const state = api.getState();
      for (const check of cfg.checks || []) {
        let passed = false;
        try {
          passed = check.test(value, state);
        } catch (err) {
          console.warn('constructed-answer check threw', err);
        }
        if (!passed) {
          api.error(check.error);
          return;
        }
      }
      api.setAnswer(value);
      api.success(cfg.successMessage || 'Fantastic work!');
      api.solve();
    }
  },
};
