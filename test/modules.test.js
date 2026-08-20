// Import-resolution smoke test.
//
// `node --check` parses each file in isolation, so it cannot catch a bad import specifier, a
// missing named export, or a re-export used as if it were a local binding. Actually importing
// every module catches all three. Every activity type is also asserted to satisfy the plugin
// contract the engine relies on.

import './setup.js';

import test from 'node:test';
import assert from 'node:assert/strict';

import { listActivityTypes, getActivityType } from '../src/activities/index.js';
import { ACTIVITY_SCHEMAS, getSchema } from '../src/activities/schemas.js';
import { listEscapes, getBank } from '../src/content/index.js';

test('every registered activity type satisfies the plugin contract', () => {
  const types = listActivityTypes();
  assert.ok(types.length > 0, 'expected at least one activity type');
  for (const t of types) {
    assert.equal(typeof t.type, 'string', `${t.type}: missing type`);
    assert.equal(typeof t.label, 'string', `${t.type}: missing label`);
    assert.equal(typeof t.mount, 'function', `${t.type}: mount must be a function`);
  }
});

test('activity types are uniquely registered', () => {
  const ids = listActivityTypes().map((t) => t.type);
  assert.equal(new Set(ids).size, ids.length, `duplicate activity type: ${ids}`);
});

test('the broken placeholder is registered so unresolvable challenges can render', () => {
  assert.ok(getActivityType('broken'), 'the "broken" fallback type must exist');
});

test('every builder schema maps to a real, renderable activity type', () => {
  for (const s of ACTIVITY_SCHEMAS) {
    assert.ok(getActivityType(s.type), `schema "${s.type}" has no matching activity type`);
    assert.equal(typeof s.label, 'string', `${s.type}: schema needs a label`);
    assert.equal(typeof s.description, 'string', `${s.type}: schema needs a description`);
    assert.ok(Array.isArray(s.fields), `${s.type}: schema needs a fields array`);
  }
});

test('schema defaults are JSON-safe', () => {
  // Custom escapes round-trip through JSON into D1, which silently drops functions. A schema
  // whose defaults contain one would save fine and then crash for students at play time.
  for (const s of ACTIVITY_SCHEMAS) {
    if (typeof s.defaults !== 'function') continue;
    const defaults = s.defaults();
    assert.deepEqual(
      JSON.parse(JSON.stringify(defaults)),
      defaults,
      `schema "${s.type}" has defaults that do not survive a JSON round-trip`
    );
  }
});

test('getSchema returns null for an unknown type rather than throwing', () => {
  assert.equal(getSchema('no-such-type'), null);
});

test('built-in escapes are well formed and reference resolvable bank ids', () => {
  const bank = getBank();
  const escapes = listEscapes();
  assert.ok(escapes.length > 0, 'expected at least one built-in escape');

  for (const e of escapes) {
    assert.equal(typeof e.id, 'string', 'escape needs an id');
    assert.equal(typeof e.title, 'string', `${e.id}: escape needs a title`);
    assert.ok(Array.isArray(e.activities), `${e.id}: escape needs an activities array`);

    for (const entry of e.activities) {
      if (typeof entry === 'string') {
        assert.ok(bank[entry], `${e.id}: unknown bank activity id "${entry}"`);
      } else {
        assert.ok(
          getActivityType(entry.type),
          `${e.id}: activity "${entry.id || entry.title}" has unknown type "${entry.type}"`
        );
      }
    }
  }
});

test('built-in escape ids are unique', () => {
  const ids = listEscapes().map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate escape id: ${ids}`);
});
