import { describe, expect, it } from "vitest";
import { buildRunningPlan } from "./runningPlan";
import {
  STARTING_WEEK_KM,
  verifyRunningPlan,
  weeklyCapKm,
  type RunProfile,
} from "./verifyRunning";
import { RUN_PROFILES } from "./fixtures/runProfiles";

const total = (plan: { days: { run: { distanceKm: number } }[] }) =>
  plan.days.reduce((km, d) => km + d.run.distanceKm, 0);

describe("buildRunningPlan", () => {
  for (const [name, profile] of Object.entries(RUN_PROFILES)) {
    it(`passes the verifier for ${name}`, () => {
      const result = verifyRunningPlan(buildRunningPlan(profile), profile);
      expect(result).toEqual({ ok: true, plan: expect.anything() });
    });
  }

  it("never exceeds the weekly cap, for any history and any number of days", () => {
    for (let lastWeekKm = 0.1; lastWeekKm <= 60; lastWeekKm += 0.3) {
      for (let runDaysPerWeek = 1; runDaysPerWeek <= 7; runDaysPerWeek++) {
        const profile: RunProfile = {
          runDaysPerWeek,
          activityLevel: "LIGHT",
          lastWeekKm,
          easyPaceSecPerKm: null,
        };
        const plan = buildRunningPlan(profile);
        expect(total(plan)).toBeLessThanOrEqual(weeklyCapKm(profile));
        expect(verifyRunningPlan(plan, profile).ok).toBe(true);
      }
    }
  });

  it("starts a new runner at the volume for their activity level", () => {
    const plan = buildRunningPlan(RUN_PROFILES.newSedentary);
    expect(total(plan)).toBeLessThanOrEqual(STARTING_WEEK_KM.SEDENTARY);
    expect(plan.days.map((d) => d.run.type)).toEqual(["EASY", "TEMPO", "LONG"]);
    expect(plan.days.every((d) => d.run.targetPaceSecPerKm === null)).toBe(
      true,
    );
  });

  it("drops run days when the week is too small for them", () => {
    expect(buildRunningPlan(RUN_PROFILES.tinyWeek).days).toHaveLength(2);
  });

  it("caps at five run days with one long run, last", () => {
    const plan = buildRunningPlan(RUN_PROFILES.sevenDays);
    expect(plan.days).toHaveLength(5);
    expect(plan.days.filter((d) => d.run.type === "LONG")).toHaveLength(1);
    expect(plan.days.at(-1)?.run.type).toBe("LONG");
  });

  it("makes the long run the longest run of the week", () => {
    for (let runDaysPerWeek = 2; runDaysPerWeek <= 5; runDaysPerWeek++) {
      const plan = buildRunningPlan({
        ...RUN_PROFILES.activeWithHistory,
        runDaysPerWeek,
      });
      const long = plan.days.find((d) => d.run.type === "LONG")!;
      for (const d of plan.days) {
        expect(long.run.distanceKm).toBeGreaterThanOrEqual(d.run.distanceKm);
      }
    }
  });

  it("sets paces from the easy pace", () => {
    const plan = buildRunningPlan(RUN_PROFILES.physicalJobFiveDays);
    const pace = Object.fromEntries(
      plan.days.map((d) => [d.run.type, d.run.targetPaceSecPerKm]),
    );
    expect(pace).toEqual({ EASY: 330, INTERVALS: 255, TEMPO: 285, LONG: 345 });
  });
});

describe("verifyRunningPlan", () => {
  const profile = RUN_PROFILES.activeWithHistory; // 20 km last week, 4 days
  const day = (type: string, distanceKm: number) => ({
    name: "Run",
    run: { type, distanceKm, targetPaceSecPerKm: null },
  });

  it("rejects a week more than 10% over last week", () => {
    const result = verifyRunningPlan(
      { name: "Too much", days: [day("EASY", 10), day("LONG", 13)] },
      profile,
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        "plan totals 23 km; last week was 20 km, so this week is at most 22 km",
      ],
    });
  });

  it("reports every problem at once", () => {
    const result = verifyRunningPlan(
      {
        name: "Bad",
        days: [
          day("LONG", 6),
          day("LONG", 6),
          day("EASY", 4),
          day("EASY", 4),
          day("EASY", 4),
        ],
      },
      profile,
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        "plan has 5 run days; the user asked for 4",
        "plan totals 24 km; last week was 20 km, so this week is at most 22 km",
        "plan has 2 long runs; one a week at most",
      ],
    });
  });

  it("rejects more run days than the user asked for", () => {
    const result = verifyRunningPlan(
      {
        name: "Extra day",
        days: [
          day("EASY", 4),
          day("EASY", 4),
          day("EASY", 4),
          day("EASY", 3),
          day("LONG", 5),
        ],
      },
      profile,
    );
    expect(result).toEqual({
      ok: false,
      problems: ["plan has 5 run days; the user asked for 4"],
    });
  });

  it("rejects more than one long run", () => {
    const result = verifyRunningPlan(
      { name: "Two long", days: [day("LONG", 8), day("LONG", 8)] },
      profile,
    );
    expect(result).toEqual({
      ok: false,
      problems: ["plan has 2 long runs; one a week at most"],
    });
  });

  it("explains the first-week limit when nothing is logged", () => {
    const result = verifyRunningPlan(
      { name: "Eager", days: [day("LONG", 8)] },
      RUN_PROFILES.newSedentary,
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        "plan totals 8 km; with no logged runs the first week is at most 6 km",
      ],
    });
  });

  it("rejects output that does not match the schema", () => {
    const result = verifyRunningPlan(
      { name: "Odd", days: [day("SPRINT", 5)] },
      profile,
    );
    expect(result.ok).toBe(false);
  });
});

describe("weeklyCapKm", () => {
  const base: RunProfile = {
    runDaysPerWeek: 3,
    activityLevel: "LIGHT",
    lastWeekKm: null,
    easyPaceSecPerKm: null,
  };
  it.each([
    [0.1, 1],
    [0.9, 1],
    [1, 1.1],
    [20, 22],
  ])("after %s km logged allows %s km", (lastWeekKm, cap) => {
    expect(weeklyCapKm({ ...base, lastWeekKm })).toBe(cap);
  });

  it("uses the starting volume when nothing is logged", () => {
    expect(weeklyCapKm(base)).toBe(STARTING_WEEK_KM.LIGHT);
  });

  // Pinned as literals so a change to the first-week load shows up as a failing test.
  it.each([
    ["SEDENTARY", 6],
    ["LIGHT", 10],
    ["ACTIVE", 15],
    ["PHYSICAL_JOB", 10],
  ] as const)("starts a new %s runner at %s km", (activityLevel, km) => {
    expect(weeklyCapKm({ ...base, activityLevel, lastWeekKm: null })).toBe(km);
  });
});
