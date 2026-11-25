import { describe, expect, it } from "vitest";
import { planDayForRun, type PlanForRun } from "./runPlanDay";

// Push, Easy run, Rest, Long run: a rotation of four days.
const plan: PlanForRun = {
  id: 7,
  createdDay: "2026-11-20",
  finishedWorkouts: 1, // Push is done, so the Easy run is next
  hasOpenWorkout: false,
  days: [
    { id: 70, kind: "STRENGTH", runType: null },
    { id: 71, kind: "RUN", runType: "EASY" },
    { id: 72, kind: "REST", runType: null },
    { id: 73, kind: "RUN", runType: "LONG" },
  ],
};

describe("planDayForRun", () => {
  it("takes the plan's next day when it is a run day", () => {
    expect(planDayForRun(plan, "2026-11-24")).toEqual({
      planId: 7,
      planDayId: 71,
      runType: "EASY",
    });
  });

  it("follows the rotation past the end of the week", () => {
    expect(
      planDayForRun({ ...plan, finishedWorkouts: 7 }, "2026-11-24"),
    ).toEqual({
      planId: 7,
      planDayId: 73,
      runType: "LONG",
    });
  });

  it("takes nothing when the next day is not a run day", () => {
    expect(
      planDayForRun({ ...plan, finishedWorkouts: 0 }, "2026-11-24"),
    ).toBeNull();
    expect(
      planDayForRun({ ...plan, finishedWorkouts: 2 }, "2026-11-24"),
    ).toBeNull();
  });

  it("takes nothing while a session is open on the plan", () => {
    expect(
      planDayForRun({ ...plan, hasOpenWorkout: true }, "2026-11-24"),
    ).toBeNull();
  });

  it("takes nothing for a run from before the plan was made", () => {
    expect(planDayForRun(plan, "2026-11-19")).toBeNull();
    expect(planDayForRun(plan, "2026-11-20")).not.toBeNull();
  });

  it("takes nothing without a plan or with an empty one", () => {
    expect(planDayForRun(null, "2026-11-24")).toBeNull();
    expect(planDayForRun({ ...plan, days: [] }, "2026-11-24")).toBeNull();
  });
});
