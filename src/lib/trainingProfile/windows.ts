// The look-back windows of the training profile (D36), shared by the derivation and the loader
// so a query reads exactly the rows the derivation uses.
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DAYS_PER_WEEK = 7;

// Rate, usual time, equipment and working weights describe how the user trains now.
export const RECENT_WEEKS = 8;
// Consistency over half a year.
export const ACTIVE_WEEKS_WINDOW = 26;

export const weeksAgo = (weeks: number, now: Date) =>
  new Date(now.getTime() - weeks * DAYS_PER_WEEK * DAY_MS);
