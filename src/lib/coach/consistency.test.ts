// Consistency of repeated coach replies for one eval profile (#64), on fixed replies.
import { describe, expect, it } from "vitest";
import { consistency, type RepeatRun } from "./consistency";

// A reply in the shape the model returns: exercise names, before ids are matched.
function reply(
  days: { exercise: string; sets: number; reps: number }[][],
): unknown {
  return {
    name: "Plan",
    days: days.map((exercises, i) => ({
      name: `Day ${i + 1}`,
      exercises: exercises.map((e) => ({ ...e, restSeconds: 90 })),
    })),
  };
}

const squatDay = [
  { exercise: "Barbell Squat", sets: 3, reps: 8 },
  { exercise: "Leg Press", sets: 3, reps: 10 },
];

function run(overrides: Partial<RepeatRun> = {}): RepeatRun {
  return {
    firstReplyPassed: true,
    reply: reply([squatDay]),
    ms: 1000,
    ...overrides,
  };
}

describe("consistency", () => {
  it("counts the runs whose first reply passed the verifier", () => {
    const runs = [run(), run(), run({ firstReplyPassed: false })];

    expect(consistency(runs)).toMatchObject({ runs: 3, firstReplyPassed: 2 });
  });

  it("counts replies identical to an earlier one, whatever the key order", () => {
    const same = reply([squatDay]);
    const reordered = {
      days: [
        {
          exercises: [
            { reps: 8, restSeconds: 90, sets: 3, exercise: "Barbell Squat" },
            { reps: 10, restSeconds: 90, sets: 3, exercise: "Leg Press" },
          ],
          name: "Day 1",
        },
      ],
      name: "Plan",
    };
    const different = reply([
      [{ exercise: "Lunge", sets: 3, reps: 8 }, squatDay[1]],
    ]);

    const result = consistency([
      run({ reply: same }),
      run({ reply: reordered }),
      run({ reply: different }),
    ]);

    expect(result).toMatchObject({ uniqueReplies: 2, exactDuplicates: 1 });
  });

  it("reports the median and slowest first-call time", () => {
    const runs = [800, 1200, 3000, 1000].map((ms) => run({ ms }));

    expect(consistency(runs).latencyMs).toEqual({
      median: 1100,
      slowest: 3000,
    });
  });

  it("leaves runs with no reply out of duplicates and latency", () => {
    const runs = [
      run(),
      run({ reply: null, ms: null, firstReplyPassed: false }),
    ];

    expect(consistency(runs)).toMatchObject({
      runs: 2,
      firstReplyPassed: 1,
      uniqueReplies: 1,
      exactDuplicates: 0,
      latencyMs: { median: 1000, slowest: 1000 },
    });
  });

  it("gives the mean overlap of exercise choices over every pair of plans", () => {
    // Plans A and B share both exercises (1); C shares one of three with each (1/3).
    const a = reply([squatDay]);
    const b = reply([[squatDay[1], squatDay[0]]]);
    const c = reply([[squatDay[0], { exercise: "Lunge", sets: 3, reps: 8 }]]);

    const result = consistency([a, b, c].map((r) => run({ reply: r })));

    expect(result.exerciseOverlap).toBeCloseTo((1 + 1 / 3 + 1 / 3) / 3, 5);
  });

  it("matches exercise names the way the coach does", () => {
    const a = reply([
      [{ exercise: "Standing Calf Raises", sets: 3, reps: 12 }, squatDay[0]],
    ]);
    const b = reply([
      [{ exercise: "standing calf raise", sets: 3, reps: 12 }, squatDay[0]],
    ]);

    expect(
      consistency([run({ reply: a }), run({ reply: b })]).exerciseOverlap,
    ).toBe(1);
  });

  it("reports the spread of weekly sets and of mean reps across plans", () => {
    const light = reply([squatDay]); // 6 sets, mean 9 reps
    const heavy = reply([
      [
        { exercise: "Barbell Squat", sets: 5, reps: 5 },
        { exercise: "Leg Press", sets: 4, reps: 6 },
      ],
      squatDay,
    ]); // 15 sets, mean 7.25 reps

    const result = consistency([run({ reply: light }), run({ reply: heavy })]);

    expect(result.weeklySets).toEqual({ min: 6, max: 15 });
    expect(result.meanReps).toEqual({ min: 7.25, max: 9 });
  });

  it("leaves overlap and spread empty with fewer than two readable plans", () => {
    const result = consistency([run(), run({ reply: { not: "a plan" } })]);

    expect(result).toMatchObject({
      exerciseOverlap: null,
      weeklySets: { min: 6, max: 6 },
      meanReps: { min: 9, max: 9 },
    });
  });
});
