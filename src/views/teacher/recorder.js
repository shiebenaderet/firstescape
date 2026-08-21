// "Clue recording" section for the challenge editor.
//
// Records with MediaRecorder (camera or mic), previews locally, and uploads only when the
// teacher confirms — a retake never touches the network. Falls back to a file picker when
// recording is unavailable, so this is never a dead end.
//
// Mutates activity.media in place and calls onChange() so the builder's live preview updates.
// The riddle text lives here rather than elsewhere in the form because it is what keeps a
// clue solvable without sound; putting it next to the recording makes that link obvious.

import { el, clear } from '../../engine/dom.js';
import { uploadMedia } from '../../engine/apiClient.js';
import { initialRecorderState, recorderReducer } from './recorderState.js';

// Preference order per kind; the first supported type wins. Chrome/Edge/Firefox/ChromeOS
// produce webm, Safari produces mp4 — both are accepted server-side.
const MIME_CANDIDATES = {
  video: ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'],
  audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'],
};

function canRecord() {
  return typeof MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function pickMime(kind) {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  for (const t of MIME_CANDIDATES[kind]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function fmtBytes(n) {
  if (!n) return '';
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function clock(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function renderRecorder(activity, onChange) {
  let state = initialRecorderState(activity.media);
  let stream = null;
  let recorder = null;
  let chunks = [];
  let blob = null;
  let timerId = null;
  let seconds = 0;
  let lastObjectUrl = null;

  const host = el('div', { class: 'recorder' });

  function dispatch(action) {
    state = recorderReducer(state, action);
    draw();
  }

  /** Release the previous blob: URL so long editing sessions don't leak memory. */
  function setObjectUrl(url) {
    if (lastObjectUrl && lastObjectUrl !== url) URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = url;
    return url;
  }

  function stopStream() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  async function startRecording(kind) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        kind === 'audio' ? { audio: true } : { audio: true, video: { width: 1280, height: 720 } }
      );
    } catch {
      dispatch({
        type: 'error',
        error: 'Could not use the camera or microphone. Check the browser permission, or upload a file instead.',
      });
      return;
    }

    const mimeType = pickMime(kind);
    chunks = [];
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      blob = new Blob(chunks, { type: recorder.mimeType || mimeType || '' });
      stopStream();
      dispatch({ type: 'stopped', blobUrl: setObjectUrl(URL.createObjectURL(blob)) });
    };
    recorder.start();

    seconds = 0;
    dispatch({ type: 'start', kind });
    timerId = setInterval(() => {
      seconds++;
      const t = host.querySelector('.rec-timer');
      if (t) t.textContent = clock(seconds);
    }, 1000);
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function onFile(file) {
    if (!file) return;
    blob = file;
    const kind = file.type.startsWith('audio') ? 'audio' : 'video';
    dispatch({ type: 'filePicked', blobUrl: setObjectUrl(URL.createObjectURL(file)), kind });
  }

  async function confirmUpload() {
    dispatch({ type: 'uploading' });
    try {
      const result = await uploadMedia(blob, state.kind);
      const media = {
        ...(activity.media || {}),
        type: state.kind,
        src: result.url,
        bytes: result.bytes,
      };
      delete media.placeholder; // a real recording is not a stand-in
      activity.media = media;
      dispatch({ type: 'uploaded', media });
      onChange();
    } catch (err) {
      dispatch({ type: 'uploadFailed', error: err.message || 'Upload failed. Your recording is still here — try again.' });
    }
  }

  function removeRecording() {
    // The R2 object is intentionally left in place: another draft may still reference it,
    // and orphans are cheap. Only the reference is dropped here.
    delete activity.media;
    dispatch({ type: 'remove' });
    onChange();
  }

  function playback(src, kind) {
    return kind === 'audio'
      ? el('audio', { class: 'rec-playback', controls: true, src })
      : el('video', { class: 'rec-playback', controls: true, playsInline: true, src });
  }

  function filePicker() {
    const input = el('input', { type: 'file', accept: 'video/*,audio/*', class: 'rec-file' });
    input.addEventListener('change', () => onFile(input.files && input.files[0]));
    return el('label', { class: 'btn btn-ghost rec-file-label' }, ['📁 Upload a file', input]);
  }

  /** The riddle text. Required whenever a recording exists — see the module header. */
  function textField() {
    const media = activity.media || {};
    const input = el('textarea', {
      class: 'field',
      rows: 2,
      placeholder: 'Type the riddle exactly as you read it aloud…',
    }, media.text || '');
    const warn = el('p', { class: 'rec-warning', hidden: !!String(media.text || '').trim() },
      '⚠️ Required: students who cannot hear the clip rely on this text.');

    input.addEventListener('input', () => {
      activity.media = { ...(activity.media || {}), text: input.value };
      warn.hidden = !!input.value.trim();
      onChange();
    });

    return el('div', { class: 'rec-text' }, [
      el('label', { class: 'field-label' }, 'Riddle text (shown on screen with the clip)'),
      input,
      warn,
    ]);
  }

  function draw() {
    clear(host);
    const rows = [];

    if (state.error) rows.push(el('p', { class: 'rec-error' }, state.error));

    if (state.phase === 'idle') {
      rows.push(el('div', { class: 'rec-actions' }, [
        canRecord() ? el('button', { class: 'btn btn-ghost', type: 'button', on: { click: () => startRecording('video') } }, '🎥 Record video') : null,
        canRecord() ? el('button', { class: 'btn btn-ghost', type: 'button', on: { click: () => startRecording('audio') } }, '🎤 Record audio') : null,
        filePicker(),
      ].filter(Boolean)));
      if (!canRecord()) {
        rows.push(el('p', { class: 'muted' }, 'This browser cannot record directly — upload a clip you recorded elsewhere.'));
      }
      rows.push(el('p', { class: 'muted' }, 'Optional. The riddle text always stays on screen, so a clip never decides whether a team can solve the puzzle.'));
    }

    if (state.phase === 'recording') {
      if (state.kind === 'video' && stream) {
        const preview = el('video', { class: 'rec-preview', muted: true, autoplay: true, playsInline: true });
        preview.srcObject = stream;
        rows.push(preview);
      }
      rows.push(el('div', { class: 'rec-actions' }, [
        el('span', { class: 'rec-dot' }, '●'),
        el('span', { class: 'rec-timer' }, clock(seconds)),
        el('button', { class: 'btn btn-primary', type: 'button', on: { click: stopRecording } }, 'Stop'),
      ]));
    }

    if (state.phase === 'review' || state.phase === 'uploading') {
      rows.push(playback(state.blobUrl, state.kind));
      const busy = state.phase === 'uploading';
      rows.push(el('div', { class: 'rec-actions' }, [
        el('button', { class: 'btn btn-primary', type: 'button', disabled: busy, on: { click: confirmUpload } }, busy ? 'Uploading…' : 'Use this'),
        el('button', { class: 'btn btn-ghost', type: 'button', disabled: busy, on: { click: () => dispatch({ type: 'retake' }) } }, 'Retake'),
      ]));
    }

    if (state.phase === 'saved' && state.media) {
      rows.push(playback(state.media.src, state.media.type));
      rows.push(el('div', { class: 'rec-actions' }, [
        el('span', { class: 'muted' }, `Uploaded${state.media.bytes ? ` · ${fmtBytes(state.media.bytes)}` : ''}`),
        el('button', { class: 'btn btn-ghost', type: 'button', on: { click: () => dispatch({ type: 'retake' }) } }, 'Replace'),
        el('button', { class: 'btn btn-ghost danger', type: 'button', on: { click: removeRecording } }, 'Remove'),
      ]));
      rows.push(textField());
    }

    for (const r of rows) host.appendChild(r);
  }

  draw();
  return host;
}
