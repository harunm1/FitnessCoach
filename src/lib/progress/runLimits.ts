// Bounds for a run logged by hand (D25), kept apart from the zod schema in
// runEntry.ts so the form can read them without bringing zod into the browser.
// The 300 km and 24 hour CHECKs in 20261124200000_run_log_upper_bounds use the
// same numbers; the lower CHECKs (above 0, effort 1 to 10) are in
// 20261124180300_range_checks. The pace bounds are checked in the app only.
export const MIN_RUN_KM = 0.1;
export const MAX_RUN_KM = 300;
export const MAX_RUN_SECONDS = 24 * 60 * 60;
// 1:30 per km is faster than any world record pace from 400 m up; 30:00 per km
// is slower than a walk. Outside them the distance or time was mistyped.
export const FASTEST_SEC_PER_KM = 90;
export const SLOWEST_SEC_PER_KM = 30 * 60;
export const MIN_EFFORT = 1;
export const MAX_EFFORT = 10;
export const MAX_RUN_NOTE_LENGTH = 300;
export const EARLIEST_RUN_DAY = "2000-01-01";

// `Workout.source` for a run logged by hand on the Progress page (D25). Not an
// import, so it counts toward the streaks like a session logged here.
export const MANUAL_RUN_SOURCE = "manual-run";
