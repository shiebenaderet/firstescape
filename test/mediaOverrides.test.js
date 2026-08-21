// Teacher recordings replacing built-in placeholder clips.
//
// Built-in escapes are JS modules in git, so the visual builder cannot edit them. The
// dashboard instead stores an activityId -> media patch map, applied by mediaFor() at play
// time. These tests pin that merge, because getting it wrong means students either keep
// hearing the sample clip or lose the riddle text.

import './setup.js';

import test from 'node:test';
import assert from 'node:assert/strict';

import { setMediaOverrideMap, mediaFor } from '../src/content/index.js';
import { builtinMediaActivities } from '../src/views/teacher/builtinMedia.js';

test('with no overrides, an activity keeps its own media', () => {
  setMediaOverrideMap({});
  const a = { id: 'riddle-x', media: { type: 'video', src: 'assets/media/x.mp4', text: 'a riddle' } };
  assert.equal(mediaFor(a).src, 'assets/media/x.mp4');
});

test('an override replaces the clip', () => {
  setMediaOverrideMap({ 'riddle-x': { src: 'https://media.example/clues/new.webm', type: 'video' } });
  const a = { id: 'riddle-x', media: { type: 'video', src: 'assets/media/x.mp4', text: 'a riddle' } };
  assert.equal(mediaFor(a).src, 'https://media.example/clues/new.webm');
});

test('an override clears the placeholder flag', () => {
  // Otherwise students would keep seeing "Sample clip" over a real recording.
  setMediaOverrideMap({ 'riddle-x': { src: 'https://media.example/clues/new.webm' } });
  const a = { id: 'riddle-x', media: { src: 'assets/media/x.mp4', text: 't', placeholder: true } };
  assert.equal(mediaFor(a).placeholder, undefined);
});

test('an override drops captions belonging to the replaced clip', () => {
  // The old .vtt describes different audio; keeping it would caption the new clip wrongly.
  setMediaOverrideMap({ 'riddle-x': { src: 'https://media.example/clues/new.webm' } });
  const a = { id: 'riddle-x', media: { src: 'old.mp4', text: 't', captions: 'old.vtt' } };
  assert.equal(mediaFor(a).captions, undefined);
});

test('an override preserves the riddle text when it supplies none', () => {
  setMediaOverrideMap({ 'riddle-x': { src: 'https://media.example/clues/new.webm' } });
  const a = { id: 'riddle-x', media: { src: 'old.mp4', text: 'the original riddle' } };
  assert.equal(mediaFor(a).text, 'the original riddle');
});

test('an override may also change the riddle text', () => {
  setMediaOverrideMap({ 'riddle-x': { src: 'https://x/new.webm', text: 'reworded riddle' } });
  const a = { id: 'riddle-x', media: { src: 'old.mp4', text: 'the original riddle' } };
  assert.equal(mediaFor(a).text, 'reworded riddle');
});

test('an override without a src is ignored', () => {
  setMediaOverrideMap({ 'riddle-x': { text: 'no clip here' } });
  const a = { id: 'riddle-x', media: { src: 'assets/media/x.mp4', text: 'original' } };
  assert.equal(mediaFor(a).src, 'assets/media/x.mp4');
  assert.equal(mediaFor(a).text, 'original');
});

test('overrides do not leak between activities', () => {
  setMediaOverrideMap({ 'riddle-x': { src: 'https://x/new.webm' } });
  const other = { id: 'riddle-y', media: { src: 'assets/media/y.m4a', text: 't' } };
  assert.equal(mediaFor(other).src, 'assets/media/y.m4a');
});

test('mediaFor is safe on activities with no media at all', () => {
  setMediaOverrideMap({});
  assert.equal(mediaFor({ id: 'plain' }), undefined);
  assert.equal(mediaFor(null), undefined);
});

test('mediaFor does not mutate the built-in activity', () => {
  // The bank is a shared module-level object; mutating it would corrupt every later render.
  setMediaOverrideMap({ 'riddle-x': { src: 'https://x/new.webm' } });
  const a = { id: 'riddle-x', media: { src: 'assets/media/x.mp4', text: 't', placeholder: true } };
  mediaFor(a);
  assert.equal(a.media.src, 'assets/media/x.mp4', 'original src must be untouched');
  assert.equal(a.media.placeholder, true, 'original placeholder flag must be untouched');
});

test('the panel finds every built-in challenge that has a clip', () => {
  const items = builtinMediaActivities();
  assert.ok(items.length >= 2, `expected the two placeholder clips, found ${items.length}`);
  const ids = items.map((i) => i.activity.id);
  assert.ok(ids.includes('riddle-keyboard'), `missing riddle-keyboard: ${ids}`);
  assert.ok(ids.includes('riddle-candle'), `missing riddle-candle: ${ids}`);
  for (const item of items) {
    assert.ok(item.escapeTitle, `${item.activity.id} has no escape title`);
    assert.ok(item.activity.media.src, `${item.activity.id} listed without a clip`);
  }
});

test('the panel lists each shared activity once', () => {
  const ids = builtinMediaActivities().map((i) => i.activity.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate entries: ${ids}`);
});
