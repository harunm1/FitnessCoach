// Ignores a second Log set tap that follows the first too closely (D31). Storing a set on
// the device takes a few milliseconds, after which the form already offers the next set,
// so without this a double tap would log a second set. No real set is logged this fast:
// the reps have to be typed or confirmed first.
export const DOUBLE_TAP_WINDOW_MS = 800;

export function createTapGuard(now: () => number = Date.now): () => boolean {
  let lastAllowed = Number.NEGATIVE_INFINITY;
  return () => {
    const time = now();
    if (time - lastAllowed < DOUBLE_TAP_WINDOW_MS) return false;
    lastAllowed = time;
    return true;
  };
}
