// The rule that a recorded clue must always carry its riddle text.
//
// The builder enforces this at save time (src/views/teacher/builder.js). The predicate is
// duplicated here rather than imported because it lives inside a DOM-heavy closure; the test
// exists to pin the RULE, and `test/modules.test.js` separately proves the builder loads.
//
// Why it matters: a clue that only exists as audio is unsolvable for a deaf student, on a
// device with broken sound, or in a silent-reading classroom.

import test from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors the guard in builder.js save(). Returns the offending activity, or undefined. */
function findSilentRecording(activities) {
  return (activities || []).find(
    (a) => a.media && a.media.src && !String(a.media.text || '').trim()
  );
}

test('a recording without riddle text is caught', () => {
  const bad = findSilentRecording([
    { title: 'Fine', media: { src: 'https://x/a.webm', text: 'a riddle' } },
    { title: 'Silent One', media: { src: 'https://x/b.webm' } },
  ]);
  assert.equal(bad?.title, 'Silent One');
});

test('whitespace-only text does not count as text', () => {
  const bad = findSilentRecording([{ title: 'Spaces', media: { src: 'https://x/a.webm', text: '   \n ' } }]);
  assert.equal(bad?.title, 'Spaces');
});

test('a challenge with no recording is unaffected', () => {
  // Text is only required *because* there is a clip to caption.
  assert.equal(findSilentRecording([{ title: 'No media' }]), undefined);
  assert.equal(findSilentRecording([{ title: 'Text only', media: { text: 'just text' } }]), undefined);
});

test('a fully specified recording passes', () => {
  assert.equal(
    findSilentRecording([{ title: 'Good', media: { type: 'video', src: 'https://x/a.webm', text: 'the riddle' } }]),
    undefined
  );
});

test('an empty escape passes', () => {
  assert.equal(findSilentRecording([]), undefined);
  assert.equal(findSilentRecording(undefined), undefined);
});

test('the built-in bank satisfies the rule', async () => {
  // Guards against a placeholder or future built-in shipping a clip with no text.
  const { bank } = await import('../src/content/bank.js');
  const offenders = Object.values(bank)
    .filter((a) => a.media && a.media.src && !String(a.media.text || '').trim())
    .map((a) => a.id);
  assert.deepEqual(offenders, [], `bank activities with a clip but no text: ${offenders}`);
});
