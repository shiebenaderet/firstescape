// Minimal browser-global shims so DOM-importing modules can be loaded under Node.
//
// The functions under test are pure, but they live in modules that import `dom.js` and
// reference `localStorage` at module scope. Rather than restructure the app for tests, we
// provide just enough of a browser for the imports to resolve. Nothing here is exercised by
// the assertions — if a test ever depends on these, it is testing the wrong thing.

const store = new Map();

globalThis.localStorage ??= {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => store.clear(),
};

globalThis.sessionStorage ??= globalThis.localStorage;

// `dom.js` calls document.createElement at call time, not import time, so a stub that throws
// loudly is better than a fake DOM: it turns "accidentally testing rendering" into a clear error.
globalThis.document ??= {
  createElement() {
    throw new Error('These tests cover pure logic only — no DOM rendering.');
  },
};
