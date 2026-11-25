// How the training profile reads to the user (a line on Progress) and to the coach (a few
// short lines, never rows) (D34).
import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";
import {
  KG_PER_LB,
  fromKg,
  weightLabel,
  type WeightUnit,
} from "@/lib/units/convert";
import type { ExperienceLevel, TrainingProfile, WorkingWeight } from "./types";

// The coach sees the strongest few lifts, not the whole list.
export const COACH_LIFTS = 6;
const NOON = 12;

function formatHour(hour: number): string {
  if (hour === 0) return "12 am";
  if (hour < NOON) return `${hour} am`;
  if (hour === NOON) return "12 pm";
  return `${hour - NOON} pm`;
}

const monthYear = (date: Date) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);

function rate(perWeek: number): string {
  if (perWeek === 0) return "no workouts in the last 8 weeks";
  const shown = Number.isInteger(perWeek)
    ? String(perWeek)
    : perWeek.toFixed(1);
  return `${shown} ${perWeek === 1 ? "workout" : "workouts"} a week`;
}

// "Training since March 2025, 3 workouts a week, usually around 6 pm."; null with no history.
export function progressLine(profile: TrainingProfile): string | null {
  if (profile.workoutCount === 0 || profile.trainingSince === null) return null;
  const time =
    profile.usualHour === null
      ? ""
      : `, usually around ${formatHour(profile.usualHour)}`;
  return `Training since ${monthYear(profile.trainingSince)}, ${rate(profile.workoutsPerWeek)}${time}.`;
}

const LEVEL_WORDS: Record<ExperienceLevel, string> = {
  BEGINNER: "a beginner",
  INTERMEDIATE: "an intermediate",
  EXPERT: "an expert",
};

const shown = (kg: number, unit: WeightUnit) => String(fromKg(kg, unit));
const estimated = (kg: number, unit: WeightUnit) =>
  Math.round(unit === "LB" ? kg / KG_PER_LB : kg);

function liftLine(lift: WorkingWeight, unit: WeightUnit): string {
  const label = weightLabel(unit);
  return `${lift.exerciseName} ${shown(lift.weightKg, unit)} ${label} x ${lift.reps} (estimated 1RM ${estimated(lift.e1rmKg, unit)} ${label})`;
}

// For the coach prompt: the headline, then one line per lift, in the user's weight unit.
export function coachSummaryLines(
  profile: TrainingProfile,
  unit: WeightUnit,
): string[] {
  const headline = progressLine(profile);
  if (headline === null) return [];
  return [
    `${headline} History suggests ${LEVEL_WORDS[profile.level]} level.`,
    ...profile.workingWeights
      .slice(0, COACH_LIFTS)
      .map((lift) => liftLine(lift, unit)),
  ];
}
