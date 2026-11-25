// Limits for the data exports (D33).
export const EXPORTS_KEPT = 20; // the newest this many per user; older ones are removed
export const EXPORTS_PER_HOUR = 10; // new exports one user can make in an hour
// A download the app has to send itself must fit Vercel's 4.5 MB body limit.
export const MAX_EXPORT_BYTES = 4_000_000;
// The most rows one file holds; past this the newest rows are kept.
export const MAX_ROWS = 20_000;
