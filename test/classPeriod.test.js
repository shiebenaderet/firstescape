// The split between `class-period` and `team-setup`.
//
// All three escapes used to open with a 5-7 field roster form, so a student's first
// experience was paperwork. The roster is now preceded by a single class-period tap, and
// team-setup drops its own period field when the value is already known — otherwise students
// answer the same question twice, which is exactly the friction the split was meant to remove.
//
// These assert the contract between the two activities. Rendering is covered by playing it.

import './setup.js';

import test from 'node:test';
import assert from 'node:assert/strict';

import { getActivityType, listActivityTypes } from '../src/activities/index.js';
import { getBuiltinEscapes } from '../src/content/index.js';
import { bank } from '../src/content/bank.js';
import { ACTIVITY_SCHEMAS } from '../src/activities/schemas.js';

test('class-period is registered and authorable', () => {
  assert.ok(getActivityType('class-period'), 'engine must know the type');
  assert.ok(
    ACTIVITY_SCHEMAS.some((s) => s.type === 'class-period'),
    'teachers must be able to add it from the builder'
  );
});

test('class-period exposes the plugin contract', () => {
  const t = listActivityTypes().find((x) => x.type === 'class-period');
  assert.equal(typeof t.mount, 'function');
  assert.equal(typeof t.label, 'string');
});

test('no built-in escape opens with a roster form', () => {
  // The finding this work addressed: a form was the first thing every student saw.
  for (const escape of getBuiltinEscapes()) {
    const first = escape.activities[0];
    const activity = typeof first === 'string' ? bank[first] : first;
    assert.notEqual(
      activity.type,
      'team-setup',
      `${escape.id} still opens with a roster form — ask the class period first instead`
    );
  }
});

test('every built-in escape still collects the class period', () => {
  // Results are grouped by period, so losing it would break the teacher dashboard.
  for (const escape of getBuiltinEscapes()) {
    const collects = (escape.activities || []).some((entry) => {
      const a = typeof entry === 'string' ? bank[entry] : entry;
      return a && (a.type === 'class-period' || a.type === 'team-setup');
    });
    assert.ok(collects, `${escape.id} never asks for the class period`);
  }
});

test('a roster always precedes any activity that depends on team names', () => {
  // quick-mixer's exit ticket checks answers against state.team.names; if the roster came
  // after it, the check would throw on an empty roster mid-game.
  for (const escape of getBuiltinEscapes()) {
    let rosterAt = -1;
    escape.activities.forEach((entry, i) => {
      const a = typeof entry === 'string' ? bank[entry] : entry;
      if (a && a.type === 'team-setup' && rosterAt === -1) rosterAt = i;
    });

    escape.activities.forEach((entry, i) => {
      const a = typeof entry === 'string' ? bank[entry] : entry;
      const usesNames = JSON.stringify(a?.config?.checks || a?.config?.steps || '')
        .includes('team');
      if (usesNames && rosterAt !== -1) {
        assert.ok(i > rosterAt, `${escape.id}: "${a.id}" uses team data but runs before the roster`);
      }
    });
  }
});

test('the class-period step asks for exactly one thing', () => {
  // Its whole reason to exist is being a single tap. A second field defeats the purpose.
  const schema = ACTIVITY_SCHEMAS.find((s) => s.type === 'class-period');
  const defaults = schema.defaults();
  assert.ok(Array.isArray(defaults.periods), 'periods list is the only required config');
  assert.equal(defaults.prompt, undefined, 'no extra required fields');
});

test('class-period defaults survive a JSON round-trip', () => {
  // Custom escapes are stored as JSON in D1; a function here would vanish silently.
  const schema = ACTIVITY_SCHEMAS.find((s) => s.type === 'class-period');
  const d = schema.defaults();
  assert.deepEqual(JSON.parse(JSON.stringify(d)), d);
});
