import { describe, expect, expectTypeOf, it } from "vitest";
import { buildDefaultPlan } from "./defaultPlan";
import { buildHybridWeek } from "./hybridWeek";
import { verifyPlan } from "./verify";
import type {
  LibraryExercise,
  VerifyProfile,
  CategorisedExercise,
} from "./verify";

const profile: VerifyProfile = {
  daysPerWeek: 1,
  equipment: ["barbell"],
  avoidMuscles: [],
};

const library: CategorisedExercise[] = [
  {
    id: "bench-press",
    category: "strength",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
  },
  {
    id: "barbell-squat",
    category: "strength",
    equipment: "barbell",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes"],
  },
  {
    id: "barbell-row",
    category: "strength",
    equipment: "barbell",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps"],
  },
];

describe("buildDefaultPlan", () => {
  it("fills a day with at least two unique compatible exercises", () => {
    const plan = buildDefaultPlan(profile, library);

    expect(plan.days).toHaveLength(1);
    expect(plan.days[0]?.exercises.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(plan.days[0]?.exercises.map((exercise) => exercise.exerciseId))
        .size,
    ).toBe(plan.days[0]?.exercises.length);
  });

  it("uses other compatible library exercises when a split has too few matches", () => {
    const plan = buildDefaultPlan(profile, library.slice(0, 2));

    expect(
      plan.days[0]?.exercises.map((exercise) => exercise.exerciseId),
    ).toEqual(["barbell-squat", "bench-press"]);
  });

  it("rejects a library that cannot provide two safe exercises for every day", () => {
    expect(() => buildDefaultPlan(profile, library.slice(0, 1))).toThrow(
      "Not enough compatible exercises for Full body",
    );
  });

  it("sets an RPE target of 7 on every exercise (#65)", () => {
    const plan = buildDefaultPlan(profile, library);

    for (const exercise of plan.days.flatMap((day) => day.exercises)) {
      expect(exercise.rpe).toBe(7);
    }
  });
});

// Records copied from the seeded free-exercise-db library (dist/exercises.json, 8 Nov),
// in the dataset's order, so stretches come before the strength match for some muscles.
function ex(
  id: string,
  category: string,
  equipment: string | null,
  primaryMuscles: string[],
  secondaryMuscles: string[],
): CategorisedExercise {
  return { id, category, equipment, primaryMuscles, secondaryMuscles };
}

const seeded: CategorisedExercise[] = [
  ex("90_90_Hamstring", "stretching", "body only", ["hamstrings"], ["calves"]),
  ex(
    "All_Fours_Quad_Stretch",
    "stretching",
    "body only",
    ["quadriceps"],
    ["quadriceps"],
  ),
  ex("Alternate_Hammer_Curl", "strength", "dumbbell", ["biceps"], ["forearms"]),
  ex("Alternating_Deltoid_Raise", "strength", "dumbbell", ["shoulders"], []),
  ex("Ankle_On_The_Knee", "stretching", null, ["glutes"], []),
  ex("Around_The_Worlds", "strength", "dumbbell", ["chest"], ["shoulders"]),
  ex(
    "Bench_Dips",
    "strength",
    "body only",
    ["triceps"],
    ["chest", "shoulders"],
  ),
  // Plyometrics, ahead of the first strength quadriceps match: catches a filter that
  // only drops stretches.
  ex(
    "Bench_Jump",
    "plyometrics",
    "body only",
    ["quadriceps"],
    ["calves", "glutes", "hamstrings"],
  ),
  ex(
    "Bent_Over_Two-Dumbbell_Row",
    "strength",
    "dumbbell",
    ["middle back"],
    ["biceps", "lats", "shoulders"],
  ),
  ex(
    "Bodyweight_Squat",
    "strength",
    "body only",
    ["quadriceps"],
    ["glutes", "hamstrings"],
  ),
  ex("Butt_Lift_Bridge", "strength", "body only", ["glutes"], ["hamstrings"]),
  ex("Chair_Lower_Back_Stretch", "stretching", null, ["lats"], ["lower back"]),
  ex(
    "Chin-Up",
    "strength",
    "body only",
    ["lats"],
    ["biceps", "forearms", "middle back"],
  ),
  ex(
    "Dumbbell_Clean",
    "strength",
    "dumbbell",
    ["hamstrings"],
    [
      "calves",
      "forearms",
      "glutes",
      "lower back",
      "quadriceps",
      "shoulders",
      "traps",
    ],
  ),
];

describe("buildDefaultPlan with the seeded library (#71, found on #15)", () => {
  const home: VerifyProfile = {
    daysPerWeek: 3,
    equipment: ["dumbbell", "body only"],
    avoidMuscles: [],
  };

  it("picks only strength exercises when the library has categories", () => {
    const plan = buildDefaultPlan(home, seeded);
    const picked = plan.days.flatMap((day) =>
      day.exercises.map((exercise) => exercise.exerciseId),
    );
    const category = new Map(seeded.map((e) => [e.id, e.category]));

    expect(new Set(picked.map((id) => category.get(id)))).toEqual(
      new Set(["strength"]),
    );
    expect(plan.days[0]?.exercises.map((e) => e.exerciseId)).toEqual([
      "Around_The_Worlds",
      "Alternating_Deltoid_Raise",
      "Bench_Dips",
    ]);
    expect(plan.days[1]?.exercises.map((e) => e.exerciseId)).toEqual([
      "Bent_Over_Two-Dumbbell_Row",
      "Chin-Up",
      "Alternate_Hammer_Curl",
    ]);
    expect(plan.days[2]?.exercises.map((e) => e.exerciseId)).toEqual([
      "Bodyweight_Squat",
      "Dumbbell_Clean",
      "Butt_Lift_Bridge",
    ]);
  });

  it("never picks an exercise without a category, even from an untyped caller", () => {
    const uncategorised = seeded.map((e) => ({ ...e, category: undefined }));

    expect(() =>
      buildDefaultPlan(home, uncategorised as unknown as CategorisedExercise[]),
    ).toThrow("Not enough compatible exercises");
  });

  it("matches the category without regard to case", () => {
    const capitalised = seeded.map((e) => ({
      ...e,
      category: e.category.toUpperCase(),
    }));

    expect(buildDefaultPlan(home, capitalised)).toEqual(
      buildDefaultPlan(home, seeded),
    );
  });

  it("requires category in its input type", () => {
    // Checked by npm run typecheck (CI), not at run time.
    expectTypeOf<LibraryExercise[]>().not.toExtend<
      Parameters<typeof buildDefaultPlan>[1]
    >();
    expectTypeOf<CategorisedExercise[]>().toExtend<
      Parameters<typeof buildDefaultPlan>[1]
    >();
  });
});

// A full-gym library in the dataset's order, kettlebell and bodyweight moves first, as in the
// live bug (#139): the first fit for each slot used to win, whatever the equipment or level.
function gym(
  id: string,
  equipment: string,
  primary: string,
  level: "BEGINNER" | "INTERMEDIATE" | "EXPERT" = "INTERMEDIATE",
): CategorisedExercise {
  return {
    id,
    category: "strength",
    equipment,
    primaryMuscles: [primary],
    secondaryMuscles: [],
    level,
  };
}

const fullGym: CategorisedExercise[] = [
  gym("kb-floor-press", "kettlebells", "chest", "BEGINNER"),
  gym("kb-row", "kettlebells", "middle back", "BEGINNER"),
  gym("cable-shoulder-press", "cable", "shoulders"),
  gym("body-up", "body only", "triceps", "BEGINNER"),
  gym("kb-squat", "kettlebells", "quadriceps", "BEGINNER"),
  gym("machine-leg-curl", "machine", "hamstrings"),
  gym("hip-thrust", "barbell", "glutes"),
  gym("barbell-bench", "barbell", "chest"),
  gym("barbell-row", "barbell", "middle back"),
  gym("barbell-squat", "barbell", "quadriceps"),
  gym("barbell-rdl", "barbell", "hamstrings"),
  gym("barbell-press", "barbell", "shoulders"),
  gym("barbell-curl", "barbell", "biceps"),
  gym("db-skull", "dumbbell", "triceps"),
  gym("cable-lat", "cable", "lats"),
  gym("calf-raise", "machine", "calves"),
  gym("cable-crunch", "cable", "abdominals"),
  gym("wrist-curl", "dumbbell", "forearms"),
  gym("db-shrug", "dumbbell", "traps"),
];

const fullGymProfile = {
  daysPerWeek: 3,
  equipment: [
    "body only",
    "dumbbell",
    "barbell",
    "cable",
    "machine",
    "kettlebells",
  ],
  avoidMuscles: [],
};

describe("buildDefaultPlan for an experienced user with a full gym (#139)", () => {
  const plan = buildDefaultPlan(
    { ...fullGymProfile, level: "EXPERT" },
    fullGym,
  );
  const ids = (day: number) =>
    plan.days[day].exercises.map((e) => e.exerciseId);

  it("gives more than four exercises a day", () => {
    plan.days.forEach((_, day) => expect(ids(day).length).toBeGreaterThan(4));
  });

  it("starts each day with a barbell compound lift, not a kettlebell or bodyweight move", () => {
    expect(ids(0)[0]).toBe("barbell-bench");
    expect(ids(1)[0]).toBe("barbell-row");
    expect(ids(2)[0]).toBe("barbell-squat");
  });

  it("prefers barbell over kettlebell when both fit the slot", () => {
    const all = plan.days.flatMap((day) =>
      day.exercises.map((e) => e.exerciseId),
    );
    expect(all).not.toContain("kb-floor-press");
    expect(all).not.toContain("kb-row");
    expect(all).not.toContain("kb-squat");
  });

  it("gives compound lifts more sets than accessories", () => {
    expect(plan.days[0].exercises[0]).toMatchObject({
      sets: 4,
      reps: 8,
      restSeconds: 120,
    });
    expect(plan.days[0].exercises.at(-1)).toMatchObject({ sets: 3, reps: 10 });
  });
});

describe("buildDefaultPlan by level (#139)", () => {
  it("keeps the old size for a beginner: no extra accessories", () => {
    const plan = buildDefaultPlan(
      { ...fullGymProfile, level: "BEGINNER" },
      fullGym,
    );
    plan.days.forEach((day) =>
      expect(day.exercises.length).toBeLessThanOrEqual(4),
    );
  });

  it("does not pick an exercise above the user's level when a fit at or below exists", () => {
    const lib = [
      gym("expert-squat", "barbell", "quadriceps", "EXPERT"),
      gym("intermediate-squat", "barbell", "quadriceps", "INTERMEDIATE"),
      gym("chest", "barbell", "chest", "BEGINNER"),
      gym("row", "barbell", "middle back", "BEGINNER"),
    ];
    const plan = buildDefaultPlan(
      { ...fullGymProfile, daysPerWeek: 1, level: "INTERMEDIATE" },
      lib,
    );
    const picked = plan.days[0].exercises.map((e) => e.exerciseId);
    expect(picked).toContain("intermediate-squat");
    expect(picked).not.toContain("expert-squat");
  });

  it("behaves as before when no level is given", () => {
    const plan = buildDefaultPlan(
      { ...fullGymProfile, daysPerWeek: 1 },
      fullGym,
    );
    expect(plan.days[0].exercises.length).toBeLessThanOrEqual(4);
  });
});

describe("buildDefaultPlan sizes and verification (#139)", () => {
  const sizes = (level: "BEGINNER" | "INTERMEDIATE" | "EXPERT", days = 3) =>
    buildDefaultPlan(
      { ...fullGymProfile, daysPerWeek: days, level },
      fullGym,
    ).days.map((day) => day.exercises.length);

  it("adds 0, 1 and 3 accessory muscles for beginner, intermediate and expert", () => {
    expect(sizes("BEGINNER")).toEqual([3, 3, 3]);
    expect(sizes("INTERMEDIATE")).toEqual([4, 4, 4]);
    expect(sizes("EXPERT")).toEqual([6, 6, 5]);
    expect(sizes("EXPERT", 1)).toEqual([7]);
  });

  it("orders a one-day expert plan with the big lifts first", () => {
    const plan = buildDefaultPlan(
      { ...fullGymProfile, daysPerWeek: 1, level: "EXPERT" },
      fullGym,
    );
    expect(plan.days[0].exercises.map((e) => e.exerciseId).slice(0, 4)).toEqual(
      ["barbell-squat", "barbell-rdl", "barbell-bench", "barbell-row"],
    );
  });

  it("keeps the old prescription and picks when no level is given", () => {
    const plan = buildDefaultPlan(
      { ...fullGymProfile, daysPerWeek: 1 },
      fullGym,
    );
    expect(plan.days[0].exercises.map((e) => e.exerciseId)).toEqual([
      "kb-squat",
      "kb-floor-press",
      "kb-row",
      "cable-shoulder-press",
    ]);
    plan.days[0].exercises.forEach((e) =>
      expect(e).toMatchObject({ sets: 3, reps: 10, restSeconds: 90, rpe: 7 }),
    );
  });

  it("gives only barbell and dumbbell lifts the heavier prescription", () => {
    const plan = buildDefaultPlan(
      { ...fullGymProfile, level: "EXPERT" },
      fullGym,
    );
    const heavy = plan.days
      .flatMap((d) => d.exercises)
      .filter((e) => e.sets === 4)
      .map((e) => e.exerciseId);
    heavy.forEach((id) =>
      expect(["barbell", "dumbbell"]).toContain(
        fullGym.find((x) => x.id === id)?.equipment,
      ),
    );
    expect(heavy).not.toContain("machine-leg-curl");
  });

  it("passes the verifier for every level and day count, and avoids a reported muscle", () => {
    const byId = new Map(fullGym.map((e) => [e.id, e]));
    (["BEGINNER", "INTERMEDIATE", "EXPERT"] as const).forEach((level) =>
      [1, 2, 3, 5, 7].forEach((days) => {
        const profile = {
          ...fullGymProfile,
          daysPerWeek: days,
          level,
          avoidMuscles: ["calves"],
        };
        const result = verifyPlan(
          buildDefaultPlan(profile, fullGym),
          profile,
          byId,
        );
        expect(result.ok, `${level} ${days}`).toBe(true);
      }),
    );
  });

  it("works for a library whose rows have no level, and a small library", () => {
    const noLevel = fullGym.map((exercise) => ({
      ...exercise,
      level: undefined,
    }));
    expect(() =>
      buildDefaultPlan({ ...fullGymProfile, level: "EXPERT" }, noLevel),
    ).not.toThrow();
    expect(() =>
      buildDefaultPlan(
        { ...fullGymProfile, daysPerWeek: 1, level: "EXPERT" },
        fullGym.slice(7, 10),
      ),
    ).not.toThrow();
  });

  it("keeps a beginner away from exercises above their level", () => {
    const lib = [
      gym("expert-squat", "barbell", "quadriceps", "EXPERT"),
      gym("beginner-squat", "machine", "quadriceps", "BEGINNER"),
      gym("chest", "machine", "chest", "BEGINNER"),
    ];
    const plan = buildDefaultPlan(
      { ...fullGymProfile, daysPerWeek: 1, level: "BEGINNER" },
      lib,
    );
    expect(plan.days[0].exercises.map((e) => e.exerciseId)).toContain(
      "beginner-squat",
    );
    expect(plan.days[0].exercises.map((e) => e.exerciseId)).not.toContain(
      "expert-squat",
    );
  });
});

describe("the quiz path from #139: fat loss, both, expert, 3 days, full gym", () => {
  it("gives each strength day more than four exercises, a barbell lift first", () => {
    const week = buildHybridWeek(
      {
        ...fullGymProfile,
        level: "EXPERT",
        daysPerWeek: 3,
        goal: "FAT_LOSS",
        trainingMode: "BOTH",
        activityLevel: "ACTIVE",
        lastWeekKm: 0,
        easyPaceSecPerKm: 360,
      },
      fullGym,
    );
    const strength = week.days.filter((d) => d.kind === "STRENGTH");
    expect(strength.length).toBeGreaterThan(0);
    for (const day of strength) {
      expect(day.exercises.length).toBeGreaterThan(4);
      expect(day.exercises[0].exerciseId).toMatch(/^barbell-/);
    }
  });
});

describe("a deadlift (primary muscle lower back) is a big lift (#145)", () => {
  it("comes before the accessories on a legs day and gets the heavier prescription", () => {
    const withDeadlift: CategorisedExercise[] = [
      ...fullGym,
      {
        id: "barbell-deadlift",
        category: "strength",
        equipment: "barbell",
        level: "intermediate",
        primaryMuscles: ["lower back"],
        secondaryMuscles: ["hamstrings"],
      },
    ];
    const plan = buildDefaultPlan(
      { ...fullGymProfile, daysPerWeek: 2, level: "EXPERT" },
      withDeadlift,
    );
    const legs = plan.days[1].exercises; // Lower body: lower back is one of its extras
    const at = legs.findIndex((e) => e.exerciseId === "barbell-deadlift");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(legs[at].sets).toBe(4);
    legs.slice(0, at).forEach((e) => expect(e.sets).toBe(4));
    legs.slice(at + 1).forEach((e) => {
      if (e.sets === 4) return;
      expect(e.sets).toBe(3);
    });
    // Every 4-set lift sits before every 3-set one.
    const lastHeavy = legs.map((e) => e.sets).lastIndexOf(4);
    const firstLight = legs.findIndex((e) => e.sets === 3);
    expect(lastHeavy).toBeLessThan(firstLight);
  });
});
