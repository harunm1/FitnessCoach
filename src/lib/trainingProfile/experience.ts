// The experience level a history shows (D36). The 6 months of consistent training for
// intermediate and "years" for advanced come from the ACSM position stand, Progression Models
// in Resistance Training for Healthy Adults (Med Sci Sports Exerc 2009; 41(3):687-708). The
// other numbers, and 24 months for "years", are our own choices.
import type { ExperienceLevel } from "./types";

export type ExperienceFacts = {
  monthsSinceFirst: number; // whole months from the first finished workout
  activeWeeksOf26: number; // weeks of the last 26 with at least one workout
  perWeekRecent: number; // workouts a week over the last 8 weeks
};

type Minimum = { months: number; activeWeeks: number; perWeek: number };

export const INTERMEDIATE_MIN: Minimum = {
  months: 6,
  activeWeeks: 13,
  perWeek: 2,
};
export const EXPERT_MIN: Minimum = { months: 24, activeWeeks: 20, perWeek: 3 };

const meets = (facts: ExperienceFacts, minimum: Minimum) =>
  facts.monthsSinceFirst >= minimum.months &&
  facts.activeWeeksOf26 >= minimum.activeWeeks &&
  facts.perWeekRecent >= minimum.perWeek;

export function experienceLevel(facts: ExperienceFacts): ExperienceLevel {
  if (meets(facts, EXPERT_MIN)) return "EXPERT";
  if (meets(facts, INTERMEDIATE_MIN)) return "INTERMEDIATE";
  return "BEGINNER";
}
