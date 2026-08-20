// Activity type: cipher
// Shows an encoded message the team must decode and type in. The ciphertext is generated
// automatically from the plaintext + scheme, so authoring is just "give me the answer".
//
// Config:
// {
//   prompt?: string,
//   scheme?: 'caesar' | 'atbash' | 'symbol',   // default 'caesar'
//   shift?: number,                            // caesar shift (default 3)
//   plaintext: string,                         // the decoded answer
//   ciphertext?: string,                       // optional manual override of the encoded text
//   accept?: string[],                         // accepted answers (default [plaintext])
//   showLegend?: boolean,                      // show the decoding legend (default true)
//   successMessage?: string,
//   wrongMessage?: string
// }

import { el } from '../engine/dom.js';
import { normalizeAnswer } from './answerMatch.js';

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SYMBOLS = '★☀☂☎☘☯☺☹✦✿❀❄❤⌘⌛⚑⚙⚡⛄⛅✈✂✒✎☂✆';

// These four are exported for unit tests; the activity itself uses them internally.
export function caesar(text, shift) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c === c.toUpperCase() ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26 + 26) % 26 + base);
  });
}
export function atbash(text) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c === c.toUpperCase() ? 65 : 97;
    return String.fromCharCode(base + (25 - (c.charCodeAt(0) - base)));
  });
}
export function symbolize(text) {
  return text.replace(/[a-z]/gi, (c) => {
    const i = A.indexOf(c.toUpperCase());
    return i >= 0 ? SYMBOLS[i] : c;
  });
}

// Answer matching is shared with the other free-text types — see answerMatch.js.
// Imported (not just re-exported) because the mount logic below calls it directly.
export const normalize = normalizeAnswer;

export default {
  type: 'cipher',
  label: 'Cipher / decode',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const scheme = cfg.scheme || 'caesar';
    const shift = cfg.shift ?? 3;
    const accepted = (cfg.accept || [cfg.plaintext]).map(normalize);

    let ciphertext = cfg.ciphertext;
    if (!ciphertext) {
      if (scheme === 'atbash') ciphertext = atbash(cfg.plaintext);
      else if (scheme === 'symbol') ciphertext = symbolize(cfg.plaintext);
      else ciphertext = caesar(cfg.plaintext, shift);
    }

    let legend = null;
    if (cfg.showLegend !== false) {
      if (scheme === 'caesar') {
        // Show how to DECODE (shift back), with concrete examples, since that's the student's task.
        const ex1 = `${caesar('A', shift)} → A`;
        const ex2 = `${caesar('E', shift)} → E`;
        legend = el('div', { class: 'cipher-legend' }, [
          el('p', {}, `🔑 How to crack it: every letter was moved ${shift} places forward in the alphabet. To read the message, move each letter ${shift} places back.`),
          el('p', { class: 'cipher-example' }, `For example: ${ex1}, ${ex2}. Then type what the message really says.`),
        ]);
      } else if (scheme === 'atbash') {
        legend = el('div', { class: 'cipher-legend' }, '🔑 How to crack it: the alphabet is flipped — swap each letter with its mirror (A ↔ Z, B ↔ Y, C ↔ X, …). Then type the real message.');
      } else if (scheme === 'symbol') {
        legend = el('div', { class: 'cipher-legend' }, [
          el('p', {}, '🔑 How to crack it: use the key below to swap each symbol for its letter, then type the word.'),
          el('div', { class: 'cipher-symbol-legend' },
            A.split('').map((letter, i) => el('span', { class: 'legend-pair' }, `${SYMBOLS[i]}=${letter}`))),
        ]);
      }
    }

    const input = el('input', {
      type: 'text',
      class: 'field',
      placeholder: 'Decoded message…',
      value: api.getAnswer() || '',
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      el('div', { class: 'cipher-text' }, ciphertext),
      legend,
      input,
      el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Decode'),
    ]));

    function submit() {
      const value = input.value.trim();
      if (!value) { api.error('Type your decoded message first!'); return; }
      if (accepted.includes(normalize(value))) {
        api.setAnswer(value);
        api.success(cfg.successMessage || 'Decoded correctly!');
        api.solve();
      } else {
        api.error(cfg.wrongMessage || 'Not decoded yet — check the legend and try again.');
      }
    }
  },
};
