import { dayKey } from "@/lib/progress/dates";
import { fromKg, weightLabel, type WeightUnit } from "@/lib/units/convert";
import type { Cell } from "./csv";

export type WorkoutSetRow = {
  startedAt: Date;
  exerciseName: string;
  setNumber: number;
  weightKg: number | null;
  reps: number;
  rpe: number | null;
  notes: string | null;
};

export type CoachMessageRow = {
  createdAt: Date;
  role: "USER" | "ASSISTANT";
  content: string;
};

const WORKOUT_HEADER = [
  "date",
  "exercise",
  "set",
  "weight",
  "unit",
  "reps",
  "rpe",
  "notes",
];

// One row per logged set. The weight is what the app shows in the user's unit (D30); a set
// with no weight (bodyweight) leaves weight and unit empty.
export function workoutCsvRows(
  sets: WorkoutSetRow[],
  unit: WeightUnit,
): Cell[][] {
  return [
    WORKOUT_HEADER,
    ...sets.map((set) => [
      dayKey(set.startedAt),
      set.exerciseName,
      set.setNumber,
      set.weightKg === null ? "" : fromKg(set.weightKg, unit),
      set.weightKg === null ? "" : weightLabel(unit),
      set.reps,
      set.rpe ?? "",
      set.notes ?? "",
    ]),
  ];
}

const ROLE_NAMES = { USER: "user", ASSISTANT: "coach" } as const;

// One row per message, in the order given, dated in ISO 8601 UTC.
export function coachCsvRows(messages: CoachMessageRow[]): Cell[][] {
  return [
    ["date", "role", "message"],
    ...messages.map((message) => [
      message.createdAt.toISOString(),
      ROLE_NAMES[message.role],
      message.content,
    ]),
  ];
}
