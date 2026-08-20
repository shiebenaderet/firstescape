// Activity type: hidden-clue
// A "search the room" puzzle: students hunt for a physical clue (a code taped under a desk,
// a number on a poster, a QR code, etc.) and enter what they find. Supports an optional image
// and a "where to look" nudge.
//
// Config:
// {
//   prompt?: string,
//   where?: string,            // a nudge about where to search
//   image?: string,            // optional image path (the clue, a map, a QR code)
//   accept: string[],          // accepted codes/answers (case-insensitive, punctuation-insensitive)
//   successMessage?: string,
//   wrongMessage?: string
// }

import { el } from '../engine/dom.js';
import { normalizeAnswer as normalize } from './answerMatch.js';

export default {
  type: 'hidden-clue',
  label: 'Hidden clue (physical search)',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const accepted = (cfg.accept || []).map(normalize);

    const input = el('input', {
      type: 'text',
      class: 'field',
      placeholder: 'Enter the code you found…',
      value: api.getAnswer() || '',
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      cfg.image ? el('img', { class: 'clue-image', src: cfg.image, alt: 'Clue' }) : null,
      cfg.where ? el('div', { class: 'search-where' }, `🔎 ${cfg.where}`) : null,
      input,
      el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Enter Code' ),
    ]));

    function submit() {
      const value = input.value.trim();
      if (!value) { api.error('Enter the code you found in the room.'); return; }
      if (accepted.includes(normalize(value))) {
        api.setAnswer(value);
        api.success(cfg.successMessage || 'That\'s the code — nice searching!');
        api.solve();
      } else {
        api.error(cfg.wrongMessage || 'That code isn\'t right — keep searching!');
      }
    }
  },
};
