// Every template's deload variant (D38, his rule 25 Nov 16:45): the same exercises on
// the same weekdays, about half the sets, a lighter load. Derived, not stored, so it can
// never drift from its template.
import type { ProgramTemplate, TemplateDay } from "./templateSchema";

// Our choice, not a sourced number (D38): about 60% of the usual working weight.
export const DELOAD_LOAD_PERCENT = 60;
const HALF = 2;

export type DeloadVariant = {
  name: string;
  loadPercent: number;
  everyWeeks: number;
  days: TemplateDay[];
};

// About half the sets, rounded up so no exercise drops to zero; everything else kept.
export const halveSets = (sets: number): number => Math.ceil(sets / HALF);

export const deloadVariant = (template: ProgramTemplate): DeloadVariant => ({
  name: `${template.name}: deload week`,
  loadPercent: DELOAD_LOAD_PERCENT,
  everyWeeks: template.deloadEveryWeeks,
  days: template.days.map((day) => ({
    ...day,
    weekdays: [...day.weekdays],
    exercises: day.exercises.map((slot) => ({
      ...slot,
      sets: halveSets(slot.sets),
    })),
  })),
});
