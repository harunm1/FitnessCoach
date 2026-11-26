// A program built from a template becomes one Plan (D38): source TEMPLATE, the
// template's id and version, a PlanDay per template day with its weekdays. Pure, so it
// is tested without a database; savePlanData (saveWeek.ts) adds the locked transaction.
import type { Prisma } from "@/generated/prisma/client";
import type { PlanInput } from "@/lib/coach/schema";
import type { ProgramTemplate, Weekday } from "./templateSchema";

export function programToPlanData(
  userId: string,
  template: ProgramTemplate,
  plan: PlanInput,
  weekdays: Weekday[][] = template.days.map((d) => d.weekdays),
): Prisma.PlanUncheckedCreateInput {
  return {
    userId,
    name: template.name,
    source: "TEMPLATE",
    active: true,
    templateId: template.id,
    templateVersion: template.version,
    days: {
      create: plan.days.map((day, dayIndex) => ({
        dayIndex,
        name: day.name,
        kind: "STRENGTH" as const,
        weekdays: weekdays[dayIndex] ?? template.days[dayIndex].weekdays,
        exercises: {
          create: day.exercises.map((slot, order) => ({
            exerciseId: slot.exerciseId,
            order,
            sets: slot.sets,
            reps: slot.reps,
            restSeconds: slot.restSeconds,
            substitutionReason: slot.substitutionReason,
          })),
        },
      })),
    },
  };
}
