// The template closest to a quiz profile (D38): "Build with the coach" starts here.
// Days per week matter most (a template's days are its structure), then level, then goal.
import { PROGRAM_TEMPLATES } from "./templates";
import type { ProgramTemplate } from "./templateSchema";

type Match = {
  daysPerWeek: number;
  level: ProgramTemplate["level"];
  goal: ProgramTemplate["goals"][number];
};

// Weights keep the order strict: one day apart outweighs any level and goal mismatch.
const DAY_WEIGHT = 100;
const LEVEL_WEIGHT = 10;
const GOAL_WEIGHT = 1;
const LEVEL_RANK = { BEGINNER: 0, INTERMEDIATE: 1, EXPERT: 2 } as const;

const distance = (t: ProgramTemplate, m: Match): number =>
  Math.abs(t.daysPerWeek - m.daysPerWeek) * DAY_WEIGHT +
  Math.abs(LEVEL_RANK[t.level] - LEVEL_RANK[m.level]) * LEVEL_WEIGHT +
  (t.goals.includes(m.goal) ? 0 : GOAL_WEIGHT);

// Ties go to the earlier template in the list.
export const closestTemplate = (m: Match): ProgramTemplate =>
  PROGRAM_TEMPLATES.reduce((best, t) =>
    distance(t, m) < distance(best, m) ? t : best,
  );
