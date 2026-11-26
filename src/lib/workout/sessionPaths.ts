// Addresses of the session screens (D46): /session is the landing, /session/[id] is one
// workout.
export const SESSION_LANDING = "/session";

export const workoutPath = (workoutId: number): string =>
  `${SESSION_LANDING}/${workoutId}`;

// The id from the address, or null when it is not a whole positive number that fits in a
// database integer, so a bad address never reaches a query.
export function parseWorkoutId(raw: string): number | null {
  if (!/^[0-9]{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= 2_147_483_647 ? id : null;
}
