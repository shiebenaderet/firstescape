// The recorder's transitions, tested without a browser. Keeping this pure means the tricky
// parts (what happens on retake, on a failed upload, on remove) are verifiable in CI, where
// MediaRecorder and getUserMedia do not exist.

import test from 'node:test';
import assert from 'node:assert/strict';

import { initialRecorderState, recorderReducer } from '../src/views/teacher/recorderState.js';

test('starts idle when the challenge has no recording', () => {
  assert.equal(initialRecorderState(null).phase, 'idle');
  assert.equal(initialRecorderState(undefined).phase, 'idle');
  // A media object with text but no src is not a recording.
  assert.equal(initialRecorderState({ text: 'a riddle' }).phase, 'idle');
});

test('starts saved when the challenge already has one', () => {
  const s = initialRecorderState({ type: 'video', src: 'https://x/clues/a.webm' });
  assert.equal(s.phase, 'saved');
  assert.equal(s.media.src, 'https://x/clues/a.webm');
  assert.equal(s.kind, 'video');
});

test('start -> recording, stop -> review', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'video' });
  assert.equal(s.phase, 'recording');
  assert.equal(s.kind, 'video');
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  assert.equal(s.phase, 'review');
  assert.equal(s.blobUrl, 'blob:x');
});

test('retake returns to idle and drops the local clip', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'audio' });
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  s = recorderReducer(s, { type: 'retake' });
  assert.equal(s.phase, 'idle');
  assert.equal(s.blobUrl, null);
});

test('a failed upload returns to review so the recording is never lost', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'video' });
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  s = recorderReducer(s, { type: 'uploading' });
  assert.equal(s.phase, 'uploading');
  s = recorderReducer(s, { type: 'uploadFailed', error: 'network down' });
  assert.equal(s.phase, 'review', 'must return to review, not idle');
  assert.equal(s.blobUrl, 'blob:x', 'the local clip must survive a failed upload');
  assert.equal(s.error, 'network down');
});

test('a retry after a failed upload can still succeed', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'video' });
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  s = recorderReducer(s, { type: 'uploading' });
  s = recorderReducer(s, { type: 'uploadFailed', error: 'oops' });
  s = recorderReducer(s, { type: 'uploading' });
  assert.equal(s.error, null, 'retrying clears the previous error');
  s = recorderReducer(s, { type: 'uploaded', media: { type: 'video', src: 'https://x/c.webm' } });
  assert.equal(s.phase, 'saved');
});

test('a successful upload lands in saved with the returned media', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'start', kind: 'video' });
  s = recorderReducer(s, { type: 'stopped', blobUrl: 'blob:x' });
  s = recorderReducer(s, { type: 'uploading' });
  s = recorderReducer(s, { type: 'uploaded', media: { type: 'video', src: 'https://x/clues/b.webm' } });
  assert.equal(s.phase, 'saved');
  assert.equal(s.media.src, 'https://x/clues/b.webm');
  assert.equal(s.blobUrl, null, 'the local object URL is released once uploaded');
  assert.equal(s.error, null);
});

test('remove clears back to idle with no media', () => {
  let s = initialRecorderState({ type: 'video', src: 'https://x/a.webm' });
  s = recorderReducer(s, { type: 'remove' });
  assert.equal(s.phase, 'idle');
  assert.equal(s.media, null);
});

test('a file picked from disk goes straight to review', () => {
  const s = recorderReducer(initialRecorderState(null), { type: 'filePicked', blobUrl: 'blob:f', kind: 'video' });
  assert.equal(s.phase, 'review');
  assert.equal(s.kind, 'video');
  assert.equal(s.blobUrl, 'blob:f');
});

test('an error can be reported without losing the current phase', () => {
  let s = recorderReducer(initialRecorderState(null), { type: 'error', error: 'permission denied' });
  assert.equal(s.phase, 'idle', 'a permission failure leaves the teacher on the picker');
  assert.equal(s.error, 'permission denied');
});

test('replacing an existing recording keeps the old one until the new upload succeeds', () => {
  // "Replace" is a retake from the saved phase: media stays put so a cancelled replace
  // does not destroy the recording that was already working.
  let s = initialRecorderState({ type: 'video', src: 'https://x/old.webm' });
  s = recorderReducer(s, { type: 'retake' });
  assert.equal(s.phase, 'idle');
  assert.equal(s.media.src, 'https://x/old.webm', 'the previous recording survives a cancelled replace');
});

test('unknown actions leave the state untouched', () => {
  const s = initialRecorderState(null);
  assert.deepEqual(recorderReducer(s, { type: 'nonsense' }), s);
});
