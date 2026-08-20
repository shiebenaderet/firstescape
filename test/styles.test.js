// Guards against a CSS trap that has now bitten this project twice.
//
// The `hidden` HTML attribute only works because the UA stylesheet says `[hidden]
// { display: none }`. ANY author rule that sets `display` on the same element wins
// (equal specificity, later origin), so the element stays visible while JS believes it is
// hidden. It produced a stuck-open emoji picker and a "✓ Solved" badge on unsolved puzzles.
//
// Every class the app toggles via `hidden` must therefore either set no `display`, or ship
// an explicit `.thing[hidden] { display: none }` rule.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');

/** Every class name the source toggles with the `hidden` attribute. */
function classesToggledByHidden() {
  const found = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.js')) {
        const src = readFileSync(path, 'utf8');
        // Matches el('tag', { class: 'a b', ..., hidden: ... })
        for (const m of src.matchAll(/class:\s*'([^']+)'[^)]*?hidden:/g)) {
          for (const c of m[1].split(/\s+/)) if (c) found.add(c);
        }
      }
    }
  };
  walk(join(ROOT, 'src'));
  return [...found];
}

/** Inspect how styles.css treats one class: does it set display, and is [hidden] guarded? */
function inspect(cls) {
  const re = new RegExp(`([^{}]*\\.${cls}(?![\\w-])[^{}]*)\\{([^}]*)\\}`, 'g');
  let display = null;
  let guarded = false;
  for (const m of css.matchAll(re)) {
    const [, selector, body] = m;
    if (selector.includes('[hidden]')) {
      if (/display:\s*none/.test(body)) guarded = true;
      continue;
    }
    const d = body.match(/display:\s*([\w-]+)/);
    if (d && d[1] !== 'none') display = d[1];
  }
  return { display, guarded };
}

test('elements toggled via the hidden attribute are not overridden by a display rule', () => {
  const offenders = [];
  for (const cls of classesToggledByHidden()) {
    const { display, guarded } = inspect(cls);
    if (display && !guarded) {
      offenders.push(`.${cls} sets "display: ${display}" but has no ".${cls}[hidden] { display: none }" rule`);
    }
  }
  assert.deepEqual(offenders, [], `hidden attribute will not work for:\n  ${offenders.join('\n  ')}`);
});

test('the audit actually finds the classes it is meant to check', () => {
  // A guard on the guard: if the source scan silently matched nothing, the test above would
  // pass vacuously and the trap would go unnoticed again.
  const found = classesToggledByHidden();
  assert.ok(found.length >= 5, `expected several hidden-toggled classes, found: ${found}`);
  assert.ok(found.includes('emoji-grid'), 'expected the emoji picker to be covered');
  assert.ok(found.includes('solved-badge'), 'expected the solved badge to be covered');
});
