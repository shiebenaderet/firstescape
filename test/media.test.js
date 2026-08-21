// Unit tests for media upload validation and key generation.
// These are pure functions so the rules are testable without R2 or a browser.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  extensionForType,
  validateUpload,
  mediaKey,
} from '../server/src/media.js';

test('extensionForType maps every allowed type to a file extension', () => {
  assert.equal(extensionForType('video/webm'), 'webm');
  assert.equal(extensionForType('video/mp4'), 'mp4');
  assert.equal(extensionForType('audio/webm'), 'weba');
  assert.equal(extensionForType('audio/mpeg'), 'mp3');
  assert.equal(extensionForType('audio/mp4'), 'm4a');
});

test('extensionForType ignores codec parameters browsers append', () => {
  // MediaRecorder reports e.g. 'video/webm;codecs=vp9,opus'.
  assert.equal(extensionForType('video/webm;codecs=vp9,opus'), 'webm');
  assert.equal(extensionForType('audio/webm; codecs=opus'), 'weba');
});

test('extensionForType is case-insensitive', () => {
  // Header values are not guaranteed lowercase.
  assert.equal(extensionForType('VIDEO/WEBM'), 'webm');
});

test('extensionForType rejects anything not on the allowlist', () => {
  assert.equal(extensionForType('application/zip'), null);
  assert.equal(extensionForType('text/html'), null);
  assert.equal(extensionForType(''), null);
  assert.equal(extensionForType(undefined), null);
  assert.equal(extensionForType(null), null);
});

test('validateUpload accepts a normal recording', () => {
  assert.deepEqual(validateUpload({ contentType: 'video/webm', contentLength: 5_000_000 }), { ok: true });
});

test('validateUpload accepts a file exactly at the limit', () => {
  assert.deepEqual(validateUpload({ contentType: 'video/webm', contentLength: MAX_MEDIA_BYTES }), { ok: true });
});

test('validateUpload rejects an unsupported type with 415', () => {
  const r = validateUpload({ contentType: 'application/zip', contentLength: 100 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 415);
});

test('validateUpload rejects an oversized file with 413', () => {
  const r = validateUpload({ contentType: 'video/webm', contentLength: MAX_MEDIA_BYTES + 1 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  // The message should tell the teacher what to do, not just that it failed.
  assert.match(r.error, /40 MB/);
});

test('validateUpload rejects an unknown length rather than streaming unbounded', () => {
  const r = validateUpload({ contentType: 'video/webm', contentLength: null });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
});

test('validateUpload rejects an empty body', () => {
  const r = validateUpload({ contentType: 'video/webm', contentLength: 0 });
  assert.equal(r.ok, false);
});

test('validateUpload checks the type before the size', () => {
  // A huge file of the wrong type should report the type problem — it is the actionable one.
  const r = validateUpload({ contentType: 'application/zip', contentLength: MAX_MEDIA_BYTES * 10 });
  assert.equal(r.status, 415);
});

test('mediaKey namespaces under clues/ and uses the right extension', () => {
  assert.equal(mediaKey('video/webm', 'abc-123'), 'clues/abc-123.webm');
  assert.equal(mediaKey('audio/mpeg', 'def-456'), 'clues/def-456.mp3');
});

test('mediaKey returns null for a disallowed type', () => {
  assert.equal(mediaKey('application/zip', 'abc'), null);
});

test('mediaKey always stays inside the clues/ prefix', () => {
  // The uuid comes from crypto.randomUUID() server-side, but assert the shape anyway:
  // a key must never be able to escape its prefix.
  const key = mediaKey('video/webm', 'a-b-c');
  assert.ok(key.startsWith('clues/'), key);
  assert.ok(!key.includes('..'), key);
});

test('every allowed type has a non-empty extension', () => {
  for (const [type, ext] of Object.entries(ALLOWED_MEDIA_TYPES)) {
    assert.ok(ext && typeof ext === 'string', `${type} has no extension`);
  }
});

test('the size limit is 40 MB', () => {
  assert.equal(MAX_MEDIA_BYTES, 40 * 1024 * 1024);
});
