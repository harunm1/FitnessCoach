// Plain data for the training profile (D34). It is computed on read from finished workouts,
// imported or live, and never stored.
export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "EXPERT";

// One logged set with the start of the workout it belongs to.
export type HistorySet = {
  exerciseId: string;
  exerciseName: string;
  equipment: string | null;
  reps: number;
  weightKg: number | null;
  startedAt: Date;
};

// The best recent set of one exercise: what the user can lift now.
export type WorkingWeight = {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  e1rmKg: number; // estimated one-rep max (Epley), kilograms
};

export type TrainingProfile = {
  workoutCount: number; // every finished workout
  trainingSince: Date | null; // the first finished workout
  workoutsPerWeek: number; // over the last 8 weeks, one decimal
  usualHour: number | null; // 0 to 23, in the app's time zone; null with under 3 workouts
  level: ExperienceLevel;
  equipment: string[]; // library names used on 2 or more sets in the last 8 weeks, most used first
  workingWeights: WorkingWeight[]; // highest estimated 1RM first
};
