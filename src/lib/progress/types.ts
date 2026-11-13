// Plain data the progress page works with (#16). load.ts fills these from Prisma, so
// everything else in src/lib/progress and the components never touches the database.
export type ProgressSet = {
  exerciseName: string;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  setNumber: number;
  reps: number;
  weightKg: number | null;
};

export type ProgressWorkout = {
  id: number;
  startedAt: Date;
  finishedAt: Date;
  dayName: string | null; // the plan day, e.g. "Push"; null if the plan was deleted
  planDays: number; // training days (STRENGTH + RUN) in the workout's plan
  distanceKm: number | null; // set when a run was logged with the workout
  runSeconds: number | null;
  sets: ProgressSet[];
};
