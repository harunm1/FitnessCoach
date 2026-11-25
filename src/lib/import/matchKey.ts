// A spelling-tolerant key for an exercise name (live feedback 24 Nov, item 9). Two names with
// the same key differ only in case, hyphens or other punctuation, spacing, a plural or a known
// typo, for example "Pull-Up", "Pull Up" and "Pullups", or "Leg Extension" and "Leg Extensions".
// It never guesses at different words: "Bench Press" and "Leg Press" keep different keys.

const MIN_PLURAL_LENGTH = 3; // shorter words ("is", "up") are never plurals; "ups" is
// Accepts a plural that adds "es": "crunches" and "presses" match; "curls" and "glutes" do not.
const ES_ENDING = /(ch|sh|ss|x|z)es$/;

// Typos that appear in Hevy exports and library names, as word to word.
const WORD_FIXES: Record<string, string> = {
  dumbell: "dumbbell",
  dumbells: "dumbbells",
  palloff: "pallof",
};

function singular(word: string): string {
  if (ES_ENDING.test(word)) return word.slice(0, -"es".length);
  // "press" and "glass" end in ss and are not plurals.
  if (word.endsWith("ss") || word.length < MIN_PLURAL_LENGTH) return word;
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

export function matchKey(name: string): string {
  // Splits on anything that is not a letter or digit: "Pull-Up (Weighted)" gives pull, up,
  // weighted; the letters "pull" are never split.
  const words = name.toLowerCase().split(/[^a-z0-9]+/);
  return words
    .filter((word) => word !== "")
    .map((word) =>
      singular(Object.hasOwn(WORD_FIXES, word) ? WORD_FIXES[word] : word),
    )
    .join("");
}
