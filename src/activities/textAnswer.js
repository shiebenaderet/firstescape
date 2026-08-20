// Activity type: text-answer
// A free-text answer checked against one or more accepted answers. Great for riddles,
// "search the room for information" clues, and fill-in-the-blank puzzles.
//
// Config:
// {
//   prompt: string,
//   placeholder?: string,
//   accept: string[],          // accepted answers (compared case-insensitively, trimmed)
//   ignore?: RegExp,           // optional characters to strip before comparing (default punctuation)
//   successMessage?: string,
//   wrongMessage?: string
// }

import { el } from '../engine/dom.js';
import { normalizeAnswer as normalize } from './answerMatch.js';

export default {
  type: 'text-answer',
  label: 'Free-text answer / riddle',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const accepted = (cfg.accept || []).map((a) => normalize(a, cfg.ignore));

    const input = el('input', {
      type: 'text',
      class: 'field',
      placeholder: cfg.placeholder || 'Type your answer…',
      value: api.getAnswer() || '',
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      input,
      el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Submit Answer'),
    ]));

    function submit() {
      const value = input.value.trim();
      if (!value) {
        api.error('Please enter an answer first!');
        return;
      }
      if (accepted.includes(normalize(value, cfg.ignore))) {
        api.setAnswer(value);
        api.success(cfg.successMessage || 'That\'s it!');
        api.solve();
      } else {
        api.error(cfg.wrongMessage || 'Not quite — talk it over and try again.');
      }
    }
  },
};
