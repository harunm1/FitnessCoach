// Every exercise a starter plan or a program template can put in front of a user (#193).
// The starter plan is built from the library, so the ids are found by running the
// builder over a grid of profiles; templates are listed by their own days.
import { readFileSync } from "node:fs";
import { buildDefaultPlan } from "@/lib/coach/defaultPlan";
import type { CategorisedExercise, VerifyProfile } from "@/lib/coach/verify";
import { PROGRAM_TEMPLATES } from "@/lib/programs/templates";

// Ids named in the live bug report (#193), kept in the set whatever the library holds.
export const REPORTED_IDS = [
  "Butt_Lift_Bridge",
  "Barbell_Side_Split_Squat",
  "Alternating_Hang_Clean",
  "Ab_Crunch_Machine",
] as const;

const MAX_DAYS = 7;
const DAY_COUNTS = Array.from({ length: MAX_DAYS }, (_, i) => i + 1);
const EQUIPMENT_SETS = [
  [],
  ["barbell"],
  ["dumbbell"],
  ["machine", "cable"],
  ["kettlebells", "bands", "e-z curl bar"],
  ["barbell", "dumbbell", "machine", "cable", "kettlebells", "bands"],
];
const LEVELS: VerifyProfile["level"][] = [
  undefined,
  "BEGINNER",
  "INTERMEDIATE",
  "EXPERT",
];

export const loadFixtureLibrary = (): CategorisedExercise[] =>
  JSON.parse(readFileSync("eval/fixtures-library.json", "utf8"));

function planIdsFor(
  profile: VerifyProfile,
  library: CategorisedExercise[],
): string[] {
  try {
    return buildDefaultPlan(profile, library).days.flatMap((day) =>
      day.exercises.map((e) => e.exerciseId),
    );
  } catch {
    return []; // a library too thin for this profile builds no plan, as in the app
  }
}

const profileGrid = (): VerifyProfile[] =>
  DAY_COUNTS.flatMap((daysPerWeek) =>
    EQUIPMENT_SETS.flatMap((equipment) =>
      LEVELS.map((level) => ({
        daysPerWeek,
        equipment,
        avoidMuscles: [],
        level,
      })),
    ),
  );

const templateIds = (): string[] =>
  PROGRAM_TEMPLATES.flatMap((template) =>
    template.days.flatMap((day) => day.exercises.map((e) => e.exerciseId)),
  );

export function starterPlanExerciseIds(
  library: CategorisedExercise[],
): string[] {
  const fromPlans = profileGrid().flatMap((p) => planIdsFor(p, library));
  return [...new Set([...REPORTED_IDS, ...fromPlans, ...templateIds()])].sort();
}
