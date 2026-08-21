// Activity type registry.
//
// To add a NEW kind of puzzle to the framework:
//   1. Create a module in this folder that default-exports an object:
//        { type: 'my-type', label: 'Human name', mount(host, api) { ... } }
//   2. Import it below and add it to the ACTIVITY_TYPES array.
// That's it — any escape can then use activities of `type: 'my-type'`.

import teamSetup from './teamSetup.js';
import multipleChoice from './multipleChoice.js';
import textAnswer from './textAnswer.js';
import teamResponses from './teamResponses.js';
import computedLock from './computedLock.js';
import constructedAnswer from './constructedAnswer.js';
import cipher from './cipher.js';
import combinationLock from './combinationLock.js';
import sequence from './sequence.js';
import hiddenClue from './hiddenClue.js';
import geoCheck from './geoCheck.js';
import classPeriod from './classPeriod.js';
import broken from './broken.js';

const ACTIVITY_TYPES = [
  classPeriod,
  teamSetup,
  multipleChoice,
  textAnswer,
  teamResponses,
  computedLock,
  constructedAnswer,
  cipher,
  combinationLock,
  sequence,
  hiddenClue,
  geoCheck,
  broken,
];

const registry = new Map(ACTIVITY_TYPES.map((t) => [t.type, t]));

export function getActivityType(type) {
  return registry.get(type) || null;
}

export function listActivityTypes() {
  return [...registry.values()];
}
