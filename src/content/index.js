// Content registry: the catalog of escapes plus the shared activity bank.
//
// To add a NEW escape:
//   1. Create a file in ./escapes that exports an escape object.
//   2. Import it here and add it to the ESCAPES array.
// To add a NEW reusable activity, add it to ./bank.js.

import { bank } from './bank.js';
import { gettingToKnowYou } from './escapes/gettingToKnowYou.js';
import { quickMixer } from './escapes/quickMixer.js';
import { cipherLab } from './escapes/cipherLab.js';

export const ESCAPES = [gettingToKnowYou, cipherLab, quickMixer];

export function listEscapes() {
  return ESCAPES;
}

export function getEscape(id) {
  return ESCAPES.find((e) => e.id === id) || null;
}

export function getBank() {
  return bank;
}
