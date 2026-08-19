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

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SYMBOLS = '★☀☂☎☘☯☺☹✦✿❀❄❤⌘⌛⚑⚙⚡⛄⛅✈✂✒✎☂✆';

function caesar(text, shift) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c === c.toUpperCase() ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26 + 26) % 26 + base);
  });
}
function atbash(text) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c === c.toUpperCase() ? 65 : 97;
    return String.fromCharCode(base + (25 - (c.charCodeAt(0) - base)));
  });
}
function symbolize(text) {
  return text.replace(/[a-z]/gi, (c) => {
    const i = A.indexOf(c.toUpperCase());
    return i >= 0 ? SYMBOLS[i] : c;
  });
}

function normalize(v) {
  return String(v).toLowerCase().replace(/[.,!?'"\-\s]+/g, ' ').trim();
}

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
        legend = el('div', { class: 'cipher-legend' }, `Caesar cipher — each letter is shifted by ${shift}. (A → ${caesar('A', shift)})`);
      } else if (scheme === 'atbash') {
        legend = el('div', { class: 'cipher-legend' }, 'Atbash cipher — the alphabet is reversed (A ↔ Z, B ↔ Y, …).');
      } else if (scheme === 'symbol') {
        legend = el('div', { class: 'cipher-legend cipher-symbol-legend' },
          A.split('').map((letter, i) => el('span', { class: 'legend-pair' }, `${SYMBOLS[i]}=${letter}`)));
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
