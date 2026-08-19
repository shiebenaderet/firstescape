// Activity type: multiple-choice
// A riddle / question with selectable options and one (or more) correct answers.
//
// Config:
// {
//   prompt: string,
//   options: Array<{ id: string, label: string }>,
//   correct: string | string[],
//   successMessage?: string,
//   wrongMessage?: string
// }

import { el } from '../engine/dom.js';

export default {
  type: 'multiple-choice',
  label: 'Multiple choice riddle',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const correct = Array.isArray(cfg.correct) ? cfg.correct : [cfg.correct];
    let selected = api.getAnswer() || null;

    const optionEls = new Map();

    function selectOption(id) {
      selected = id;
      for (const [oid, node] of optionEls) {
        node.classList.toggle('selected', oid === id);
      }
    }

    const optionsWrap = el('div', { class: 'options' },
      (cfg.options || []).map((opt) => {
        const node = el('button', {
          type: 'button',
          class: 'option' + (selected === opt.id ? ' selected' : ''),
          on: { click: () => selectOption(opt.id) },
        }, opt.label);
        optionEls.set(opt.id, node);
        return node;
      })
    );

    const body = el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      optionsWrap,
      el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Submit Answer'),
    ]);

    host.appendChild(body);

    function submit() {
      if (!selected) {
        api.error('Please select an answer first!');
        return;
      }
      if (correct.includes(selected)) {
        api.setAnswer(selected);
        api.success(cfg.successMessage || 'Correct!');
        api.solve();
      } else {
        api.error(cfg.wrongMessage || 'Not quite — discuss it as a team and try again.');
      }
    }
  },
};
