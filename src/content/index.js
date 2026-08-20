// Content registry: built-in escapes + the shared activity bank, plus any custom escapes
// published from the teacher dashboard (loaded at runtime from the API).
//
// To add a NEW built-in escape:
//   1. Create a file in ./escapes that exports an escape object.
//   2. Import it here and add it to the BUILTIN_ESCAPES array.
// To add a NEW reusable activity, add it to ./bank.js.
// Custom escapes authored in the dashboard are merged in via registerCustomEscapes().

import { bank } from './bank.js';
import { gettingToKnowYou } from './escapes/gettingToKnowYou.js';
import { quickMixer } from './escapes/quickMixer.js';
import { cipherLab } from './escapes/cipherLab.js';

const BUILTIN_ESCAPES = [gettingToKnowYou, cipherLab, quickMixer];

let customEscapes = [];
let hiddenIds = new Set();

/** Merge in custom escapes (from the API). Each is a full escape object with a unique id. */
export function registerCustomEscapes(list) {
  const builtinIds = new Set(BUILTIN_ESCAPES.map((e) => e.id));
  customEscapes = (list || [])
    .filter((e) => e && e.id && !builtinIds.has(e.id))
    .map((e) => ({ ...e, custom: true }));
}

/** Built-in room ids the teacher has hidden from the student hub. */
export function setHiddenEscapes(list) {
  hiddenIds = new Set(list || []);
}
export function getHiddenEscapes() {
  return [...hiddenIds];
}

export function getBuiltinEscapes() {
  return BUILTIN_ESCAPES;
}

export function listEscapes() {
  return [...BUILTIN_ESCAPES, ...customEscapes];
}

/** Escapes shown to students: everything except hidden built-ins. (Custom escapes are
 *  already filtered server-side to only the published ones.) */
export function listVisibleEscapes() {
  return listEscapes().filter((e) => !hiddenIds.has(e.id));
}

export function getEscape(id) {
  return listEscapes().find((e) => e.id === id) || null;
}

export function getBank() {
  return bank;
}
