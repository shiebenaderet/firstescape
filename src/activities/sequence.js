// Activity type: sequence
// Reproduce an ordered sequence by clicking pads in the right order — e.g. a musical/pattern
// lock. Each pad can play a tone (freq) or an audio file (sound), supporting "musical sequences".
//
// Config:
// {
//   prompt?: string,
//   pads: Array<{ id: string, label: string, freq?: number, sound?: string, color?: string }>,
//   answer: string[],          // correct order of pad ids
//   showAnswerLength?: boolean, // show how many presses are expected (default true)
//   successMessage?: string,
//   wrongMessage?: string
// }

import { el } from '../engine/dom.js';

let audioCtx = null;
function beep(freq) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.32);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.34);
  } catch {
    /* audio not available; the sequence still works visually */
  }
}

export default {
  type: 'sequence',
  label: 'Ordered / musical sequence',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const answer = cfg.answer || [];
    const padList = cfg.pads || [];
    let entered = [];

    const enteredEl = el('div', { class: 'sequence-entered' });
    function renderEntered() {
      enteredEl.textContent = entered.length
        ? entered.map((id) => (padList.find((p) => p.id === id) || {}).label || id).join('  →  ')
        : 'Press the pads in order…';
    }
    renderEntered();

    function press(pad) {
      entered.push(pad.id);
      if (pad.sound) {
        new Audio(pad.sound).play().catch(() => {});
      } else if (pad.freq) {
        beep(pad.freq);
      }
      renderEntered();
    }

    const pads = padList.map((pad) =>
      el('button', {
        class: 'seq-pad',
        'aria-label': `Play ${pad.label}`,
        style: pad.color ? { background: pad.color } : null,
        on: { click: () => press(pad) },
      }, pad.label)
    );

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      cfg.showAnswerLength !== false
        ? el('p', { class: 'sequence-hint' }, `The code is ${answer.length} presses long.`)
        : null,
      el('div', { class: 'seq-pads' }, pads),
      enteredEl,
      el('div', { class: 'sequence-controls' }, [
        el('button', { class: 'btn btn-ghost', on: { click: () => { entered = []; renderEntered(); } } }, 'Clear'),
        el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Submit Sequence'),
      ]),
    ]));

    function submit() {
      if (!answer.length) {
        api.error('No secret sequence has been set for this challenge yet — ask your teacher.');
        return;
      }
      if (entered.length !== answer.length) {
        api.error(`That's ${entered.length} presses — the code is ${answer.length} long. Press "Clear" to retry.`);
        return;
      }
      const correct = entered.every((id, i) => id === answer[i]);
      if (correct) {
        api.setAnswer(entered.slice());
        api.success(cfg.successMessage || 'Perfect rhythm — the sequence unlocks!');
        api.solve();
      } else {
        api.error(cfg.wrongMessage || 'That sequence is off. Listen again and retry.');
        entered = [];
        renderEntered();
      }
    }
  },
};
