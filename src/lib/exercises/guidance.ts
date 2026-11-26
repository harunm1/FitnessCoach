// Form guidance for an exercise (#193, D45). Two tiers: the curated cues and common
// mistakes in prisma/data/exercise-cues.json (D26), and, for every other exercise, the
// dataset's own step-by-step instructions, stored as cues. The session page shows
// "Form guidance" whenever the stored cues or common mistakes are not empty.

export type ExerciseGuidance = {
  cues: string[];
  commonMistakes: string[];
};

export type GuidanceSources = {
  curated?: ExerciseGuidance;
  // free-exercise-db `instructions`: public domain, steps in order.
  instructions: readonly string[];
  // Short cues we wrote for a dataset row that ships no instructions (D45).
  fallbackCues?: readonly string[];
};

const cleanSteps = (steps: readonly string[]): string[] =>
  steps.map((step) => step.trim()).filter((step) => step.length > 0);

export function guidanceForSeed({
  curated,
  instructions,
  fallbackCues = [],
}: GuidanceSources): ExerciseGuidance {
  if (curated) return curated;
  const steps = cleanSteps(instructions);
  return {
    cues: steps.length > 0 ? steps : cleanSteps(fallbackCues),
    commonMistakes: [],
  };
}

export const hasGuidance = (guidance: ExerciseGuidance): boolean =>
  guidance.cues.length > 0 || guidance.commonMistakes.length > 0;

// Curated rows always carry common mistakes; rows filled from the dataset's instructions
// never do. The starter plan keeps preferring the curated tier (D26) through this.
export const curatedCues = (row: ExerciseGuidance): string[] =>
  row.commonMistakes.length > 0 ? row.cues : [];

// Rows as the quiz hands them to the starter plan: cues only for curated rows.
export const withCuratedCues = <T extends ExerciseGuidance>(
  rows: readonly T[],
): Omit<T, "commonMistakes">[] =>
  rows.map(({ commonMistakes, ...row }) => ({
    ...row,
    cues: curatedCues({ cues: row.cues, commonMistakes }),
  }));
