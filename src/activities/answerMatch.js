// Shared answer normalization for the free-text activity types (text-answer, hidden-clue,
// cipher). One implementation so a fix — or a deliberate loosening — applies everywhere.
//
// The rule: forgive typography, not meaning.
//   - deleted   ' ’ .     so "don't" === "dont" and "T.V." === "tv"
//   - separators , ! ? " - and whitespace collapse to one space,
//                          so "ice-cream" === "ice cream" but not "icecream"
//
// Deleting vs. separating matters: collapsing an apostrophe to a space turns "don't" into
// "don t", which fails a team that typed the same word without the punctuation. The curly
// apostrophe (U+2019) is included because tablets substitute it automatically — grading
// must not depend on which device a student used.

const STRIP = /['’.]+/g;
const SEPARATORS = /[,!?"\-\s]+/g;

/**
 * Normalize a submitted or accepted answer for comparison.
 * @param {unknown} value
 * @param {RegExp} [ignore] Optional override; when supplied it replaces the separator pass
 *   (kept for escapes that set a custom `ignore` in their config).
 */
export function normalizeAnswer(value, ignore) {
  return String(value)
    .toLowerCase()
    .replace(STRIP, '')
    .replace(ignore ?? SEPARATORS, ' ')
    .trim();
}

/** True when `value` matches any of `accepted` (which may be raw, unnormalized strings). */
export function matchesAnswer(value, accepted, ignore) {
  const needle = normalizeAnswer(value, ignore);
  return (accepted || []).some((a) => normalizeAnswer(a, ignore) === needle);
}
