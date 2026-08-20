// Unit tests for the pure logic that would be painful to debug from the classroom.
//
// Run with:  npm test        (from the repo root — no dependencies, Node's built-in runner)
//
// Scope: functions with no DOM and no network. Rendering is covered by playing the game.
// A few modules import DOM helpers at load time, so `test/setup.js` installs the minimal
// globals those imports touch before anything else is imported.

import './setup.js';

import test from 'node:test';
import assert from 'node:assert/strict';

import { caesar, atbash, symbolize, normalize } from '../src/activities/cipher.js';
import { toCSV, buildDefaultRecord } from '../src/engine/results.js';
import { fastestTime, answersOf, prettyLabel } from '../src/views/teacher/results.js';

/* --------------------------------- cipher --------------------------------- */

test('caesar shifts letters and wraps past Z', () => {
  assert.equal(caesar('ABC', 3), 'DEF');
  assert.equal(caesar('XYZ', 3), 'ABC');
});

test('caesar preserves case and leaves non-letters alone', () => {
  assert.equal(caesar('Hello, World!', 1), 'Ifmmp, Xpsme!');
});

test('caesar is reversible with the inverse shift', () => {
  const secret = 'TEAMWORK';
  assert.equal(caesar(caesar(secret, 7), -7), secret);
});

test('caesar handles a zero and a full-alphabet shift as identity', () => {
  assert.equal(caesar('PUZZLE', 0), 'PUZZLE');
  assert.equal(caesar('PUZZLE', 26), 'PUZZLE');
});

test('atbash mirrors the alphabet and is its own inverse', () => {
  assert.equal(atbash('ABC'), 'ZYX');
  assert.equal(atbash(atbash('ESCAPE')), 'ESCAPE');
});

test('symbolize maps letters to symbols and round-trips length', () => {
  const out = symbolize('AB');
  assert.notEqual(out, 'AB');
  assert.equal(out.length, 2);
  // Spaces and punctuation pass through untouched.
  assert.match(symbolize('A B'), / /);
});

test('normalize makes student answers forgiving', () => {
  // Case, surrounding whitespace, and punctuation should never fail a correct team.
  assert.equal(normalize('  An Egg!  '), normalize('an egg'));
  assert.equal(normalize('TEAM-WORK'), normalize('team work'));
});

test('normalize deletes apostrophes and dots rather than splitting on them', () => {
  // A team that skips the apostrophe is still right.
  assert.equal(normalize("Don't"), normalize('dont'));
  assert.equal(normalize('T.V.'), normalize('tv'));
});

test('normalize treats the curly apostrophe like a straight one', () => {
  // Tablets with smart punctuation substitute U+2019; grading must not depend on the device.
  assert.equal(normalize('don’t'), normalize("don't"));
  assert.equal(normalize('don’t'), 'dont');
});

test('normalize keeps separators as word boundaries', () => {
  // Hyphens and spaces are equivalent, but words must not be silently glued together.
  assert.equal(normalize('ice-cream'), normalize('ice cream'));
  assert.notEqual(normalize('ice cream'), normalize('icecream'));
});

test('normalize collapses runs of whitespace and punctuation', () => {
  assert.equal(normalize('a   b'), 'a b');
  assert.equal(normalize('a, , b'), 'a b');
});

/* ----------------------------------- CSV ---------------------------------- */

test('toCSV returns empty string for no records', () => {
  assert.equal(toCSV([]), '');
});

test('toCSV quotes commas, quotes and newlines', () => {
  const csv = toCSV([{ a: 'x,y', b: 'say "hi"', c: 'line1\nline2' }]);
  const [, row] = csv.split('\n');
  assert.ok(csv.startsWith('a,b,c'));
  assert.ok(row.includes('"x,y"'));
  assert.ok(row.includes('"say ""hi"""'));
});

test('toCSV unions columns across rows with differing keys', () => {
  // Two teams that played different rooms must still export into one sheet.
  const csv = toCSV([{ team: 'A', 'Riddle 1': 'egg' }, { team: 'B', 'Vault': '42' }]);
  const [header, rowA, rowB] = csv.split('\n');
  assert.equal(header, 'team,Riddle 1,Vault');
  assert.equal(rowA, 'A,egg,');   // blank where the column doesn't apply
  assert.equal(rowB, 'B,,42');
});

test('toCSV renders null and undefined as empty cells', () => {
  const csv = toCSV([{ a: null, b: undefined, c: 0 }]);
  assert.equal(csv.split('\n')[1], ',,0');
});

/* ------------------------------ record builder ---------------------------- */

test('buildDefaultRecord captures roster, period and answers', () => {
  const escape = { id: 'demo', title: 'Demo Room' };
  const state = {
    team: { period: '3', size: 2, members: [{ name: 'Ava', subject: 'Math' }, { name: 'Ben', subject: 'Art' }] },
    answers: { 'riddle-1': 'egg', 'writing-1': ['one', 'two'] },
  };
  const rec = buildDefaultRecord(escape, state, { completionTime: '12:34' });

  assert.equal(rec.escapeId, 'demo');
  assert.equal(rec.period, '3');
  assert.equal(rec.completionTime, '12:34');
  assert.equal(rec.team, 'Ava (Math); Ben (Art)');
  assert.equal(rec['answer:riddle-1'], 'egg');
  assert.equal(rec['answer:writing-1'], 'one | two');
});

test('buildDefaultRecord omits the roster echo but keeps other answers', () => {
  const state = {
    team: { period: '1', members: [] },
    answers: { 'setup-team': { period: '1' }, 'riddle-1': 'egg' },
  };
  const rec = buildDefaultRecord({ id: 'x', title: 'X' }, state, { completionTime: '00:30' });
  assert.ok(!('answer:setup-team' in rec));
  assert.equal(rec['answer:riddle-1'], 'egg');
});

test('buildDefaultRecord survives an empty state', () => {
  const rec = buildDefaultRecord({ id: 'x', title: 'X' }, {}, { completionTime: '00:01' });
  assert.equal(rec.period, '');
  assert.equal(rec.team, '');
});

/* ------------------------------ results view ------------------------------ */

test('fastestTime picks the smallest mm:ss, not the lexically smallest', () => {
  // '9:59' sorts before '10:00' as a string only by luck; 100:00 vs 99:59 breaks naive sorts.
  assert.equal(fastestTime([{ completion_time: '10:00' }, { completion_time: '09:59' }]), '09:59');
  assert.equal(fastestTime([{ completion_time: '100:00' }, { completion_time: '99:59' }]), '99:59');
});

test('fastestTime returns a dash when there are no usable times', () => {
  assert.equal(fastestTime([]), '—');
  assert.equal(fastestTime([{ completion_time: null }]), '—');
});

test('answersOf extracts written work from the stored record JSON', () => {
  const row = { data: JSON.stringify({ period: '2', 'answer:riddle-1': 'egg', 'answer:motto': 'We rise' }) };
  const answers = answersOf(row);
  assert.equal(answers.length, 2);
  assert.deepEqual(answers.map((a) => a.value), ['egg', 'We rise']);
  // Non-answer keys stay out of the detail panel.
  assert.ok(!answers.some((a) => a.value === '2'));
});

test('answersOf tolerates missing and malformed data', () => {
  assert.deepEqual(answersOf({}), []);
  assert.deepEqual(answersOf({ data: 'not json' }), []);
  assert.deepEqual(answersOf({ data: 'null' }), []);
});

test('answersOf drops blank answers so the panel stays clean', () => {
  const row = { data: JSON.stringify({ 'answer:a': '', 'answer:b': null, 'answer:c': 'kept' }) };
  assert.deepEqual(answersOf(row).map((a) => a.value), ['kept']);
});

test('prettyLabel turns an activity id into something a teacher can read', () => {
  assert.equal(prettyLabel('cipher-lab-riddle-2'), 'Cipher lab riddle 2');
  assert.equal(prettyLabel('motto'), 'Motto');
});
