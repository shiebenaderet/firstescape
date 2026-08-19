// Activity type: computed-lock
// A multi-step lock whose expected values are computed from prior answers / team state.
// Each step is validated independently so teams get targeted feedback.
//
// Config:
// {
//   steps: Array<{
//     label: string,
//     placeholder?: string,
//     compute: (state) => number | string,   // the correct value for this step
//     error?: (state, correct) => string      // custom error message
//   }>,
//   successMessage?: (state) => string | string
// }

import { el } from '../engine/dom.js';

export default {
  type: 'computed-lock',
  label: 'Computed multi-step lock',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const state = api.getState();
    const saved = api.getAnswer() || [];

    const inputs = (cfg.steps || []).map((step, i) =>
      el('input', {
        type: 'number',
        class: 'field',
        placeholder: step.placeholder || `Step ${i + 1} answer`,
        value: saved[i] != null ? saved[i] : '',
      })
    );

    host.appendChild(el('div', { class: 'activity-body' },
      [
        ...(cfg.steps || []).flatMap((step, i) => [
          el('p', { class: 'step-label' }, [el('strong', {}, `Step ${i + 1}: `), step.label]),
          inputs[i],
        ]),
        el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Open the Vault'),
      ]
    ));

    function submit() {
      const answers = [];
      for (let i = 0; i < cfg.steps.length; i++) {
        const step = cfg.steps[i];
        const raw = inputs[i].value.trim();
        const correct = step.compute(api.getState());
        const provided = typeof correct === 'number' ? parseInt(raw, 10) : raw;

        if (provided === '' || (typeof correct === 'number' && Number.isNaN(provided)) || provided !== correct) {
          api.error(
            step.error
              ? step.error(api.getState(), correct)
              : `Step ${i + 1} isn't right yet — check your work and try again.`
          );
          return;
        }
        answers.push(correct);
      }
      api.setAnswer(answers);
      const msg = typeof cfg.successMessage === 'function'
        ? cfg.successMessage(api.getState())
        : (cfg.successMessage || 'The vault clicks open!');
      api.success(msg);
      api.solve();
    }
  },
};
