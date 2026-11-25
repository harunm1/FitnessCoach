// Plain data for the history pages (D28). load.ts fills these from Prisma, so the
// pages, components and view helpers never touch the database.

export type HistorySet = {
  setNumber: number;
  reps: number;
  weightKg: number | null;
  rpe: number | null; // rate of perceived exertion, 1 to 10, when logged
};

export type HistoryRow = {
  id: number;
  name: string;
  startedAt: Date;
  minutes: number;
  sets: number;
  imported: boolean; // read from another app's export (#131)
};

export type HistoryPage = { rows: HistoryRow[]; hasNext: boolean };

export type WorkoutDetail = {
  id: number;
  name: string;
  startedAt: Date;
  minutes: number;
  imported: boolean;
  notes: string | null; // an imported workout's notes are its title, so null here
  run: { distanceKm: number; seconds: number; rpe: number | null } | null;
  exercises: { id: string; name: string; sets: HistorySet[] }[];
};

export type ExerciseHistory = {
  id: string;
  name: string;
  // True when the set limit cut the list: older workouts are not shown.
  olderHidden: boolean;
  // Newest workout first; sets in set order.
  workouts: { workoutId: number; startedAt: Date; sets: HistorySet[] }[];
};
