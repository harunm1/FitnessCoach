import { describe, expect, expectTypeOf, it } from "vitest";
import { buildDefaultPlan } from "./defaultPlan";
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

  it("fails closed when shoulder pain has no suitable mapped push alternative", () => {
    const jointProfile: VerifyProfile = {
      ...profile,
      reportedJoints: ["shoulder"],
    };
    const jointLibrary: CategorisedExercise[] = [
      {
        id: "Barbell_Bench_Press_-_Medium_Grip",
        category: "strength",
        equipment: "barbell",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps"],
      },
      {
        id: "Incline_Push-Up",
        category: "strength",
        equipment: "body only",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps"],
      },
    ];

    expect(() => buildDefaultPlan(jointProfile, jointLibrary)).toThrow(
      "Not enough compatible exercises",
    );
  });

  it("records an exact reason for a real same-pattern hip substitution", () => {
    const jointProfile: VerifyProfile = {
      daysPerWeek: 1,
      equipment: ["body only"],
      avoidMuscles: [],
      reportedJoints: ["hip"],
    };
    const jointLibrary: CategorisedExercise[] = [
      {
        id: "Reverse_Crunch",
        category: "strength",
        equipment: "body only",
        primaryMuscles: ["abdominals"],
        secondaryMuscles: [],
      },
      {
        id: "Crunches",
        category: "strength",
        equipment: "body only",
        primaryMuscles: ["abdominals"],
        secondaryMuscles: [],
      },
      {
        id: "Incline_Push-Up",
        category: "strength",
        equipment: "body only",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps"],
      },
    ];

    const plan = buildDefaultPlan(jointProfile, jointLibrary);
    expect(
      plan.days[0]?.exercises.map((exercise) => exercise.exerciseId),
    ).toContain("Crunches");
    expect(
      plan.days[0]?.exercises.find(
        (exercise) => exercise.exerciseId === "Crunches",
      )?.substitutionReason,
    ).toBe("avoids hip loading");
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
