// Reads the history pages' link values (D29). Anything unexpected becomes the first
// page or null, so a hand-edited link shows page 1 or a 404, never a server error.

export const PAGE_SIZE = 20;
// 1,000 pages of 20 is 20,000 workouts, more than years of daily training; the cap
// keeps a hand-edited link from asking Postgres for a huge OFFSET.
export const MAX_PAGE = 1000;
// Workout.id is a Postgres integer; a bigger number makes Prisma throw.
const MAX_INT = 2_147_483_647;
// free-exercise-db slugs are well under this; the cap keeps a junk link out of the query.
const MAX_EXERCISE_ID_LENGTH = 200;
// A whole number from 1 up, digits only: matches "41", rejects "0", "041", "4.1", " 4".
const WHOLE_NUMBER = /^[1-9]\d*$/;

export function parsePage(value: string | undefined): number {
  if (!value || !WHOLE_NUMBER.test(value)) return 1;
  return Math.min(Number(value), MAX_PAGE);
}

export function parseWorkoutId(value: string): number | null {
  if (!WHOLE_NUMBER.test(value)) return null;
  const id = Number(value);
  return id <= MAX_INT ? id : null;
}

export function parseExerciseId(value: string): string | null {
  return value.length > 0 && value.length <= MAX_EXERCISE_ID_LENGTH
    ? value
    : null;
}
