// The deterministic guardrails (D38): each out-of-bounds case is rejected on its own.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CategorisedExercise } from "@/lib/coach/verify";
import type { PlanInput } from "@/lib/coach/schema";
import { getTemplate } from "./templates";
import {
  MAX_WEEKLY_SETS_PER_MUSCLE,
  checkProgram,
  templateToPlan,
  weeklySetsByMuscle,
} from "./guardrails";

const library: CategorisedExercise[] = JSON.parse(
  readFileSync("eval/fixtures-library.json", "utf8"),
);
const byId = new Map(library.map((e) => [e.id, e]));
const template = getTemplate("upper-lower-4")!;
const profile = {
  daysPerWeek: 4,
  equipment: ["barbell", "dumbbell", "cable"],
  avoidMuscles: [],
};
const ctx = { template, library: byId, profile };

// A deep copy of the template as a plan, edited by `edit` before the check.
function planWith(edit: (plan: PlanInput) => void): PlanInput {
  const plan = structuredClone(templateToPlan(template));
  edit(plan);
  return plan;
}

describe("checkProgram", () => {
  it("passes the unedited template", () => {
    expect(checkProgram(templateToPlan(template), ctx)).toEqual([]);
  });

  it("rejects an exercise that is not in the library", () => {
    const plan = planWith((p) => {
      p.days[0].exercises[0].exerciseId = "Made_Up_Press";
    });
    expect(checkProgram(plan, ctx).join()).toMatch(
      /not in the exercise library/,
    );
  });

  it("rejects an exercise that needs equipment the user does not have", () => {
    const plan = planWith((p) => {
      p.days[0].exercises[0].exerciseId = "Machine_Bench_Press";
    });
    expect(checkProgram(plan, ctx).join()).toMatch(/needs machine/);
  });

  it("rejects an exercise that works a muscle the user reported trouble with", () => {
    const problems = checkProgram(templateToPlan(template), {
      ...ctx,
      profile: { ...profile, avoidMuscles: ["biceps"] },
    });
    expect(problems.join()).toMatch(/reported trouble with/);
  });

  it("rejects sets above the coaching limit", () => {
    const plan = planWith((p) => {
      p.days[0].exercises[0].sets = 9;
    });
    expect(checkProgram(plan, ctx).join()).toMatch(/sets/);
  });

  it("rejects reps outside the template's rep band", () => {
    const low = planWith((p) => {
      p.days[0].exercises[0].reps = template.repBand.min - 1;
    });
    const high = planWith((p) => {
      p.days[0].exercises[0].reps = template.repBand.max + 1;
    });
    expect(checkProgram(low, ctx).join()).toMatch(
      /outside the 5 to 12 rep band/,
    );
    expect(checkProgram(high, ctx).join()).toMatch(
      /outside the 5 to 12 rep band/,
    );
  });

  it("rejects a day with fewer than 4 exercises", () => {
    const plan = planWith((p) => {
      p.days[1].exercises = p.days[1].exercises.slice(0, 3);
    });
    expect(checkProgram(plan, ctx).join()).toMatch(/fewer than 4 exercises/);
  });

  it("rejects the same exercise twice on one day", () => {
    const plan = planWith((p) => {
      p.days[0].exercises[1].exerciseId = p.days[0].exercises[0].exerciseId;
    });
    expect(checkProgram(plan, ctx).join()).toMatch(/twice/);
  });

  it("rejects more than the weekly set ceiling for one muscle", () => {
    const plan = planWith((p) => {
      // Upper A and Upper B each get chest work at 6 sets on four slots.
      for (const day of [p.days[0], p.days[2]]) {
        day.exercises = [
          {
            ...day.exercises[0],
            exerciseId: "Barbell_Bench_Press_-_Medium_Grip",
            sets: 6,
          },
          { ...day.exercises[1], exerciseId: "Dumbbell_Bench_Press", sets: 6 },
          {
            ...day.exercises[2],
            exerciseId: "Incline_Dumbbell_Press",
            sets: 6,
          },
          { ...day.exercises[3], exerciseId: "Dumbbell_Flyes", sets: 6 },
        ];
      }
    });
    expect(weeklySetsByMuscle(plan, byId).get("chest")).toBeGreaterThan(
      MAX_WEEKLY_SETS_PER_MUSCLE,
    );
    expect(checkProgram(plan, ctx).join()).toMatch(/chest: 48 sets a week/);
  });

  it("rejects a plan with a different number of days than the template", () => {
    const plan = planWith((p) => {
      p.days.pop();
    });
    expect(checkProgram(plan, ctx).join()).toMatch(/days/);
  });
});
