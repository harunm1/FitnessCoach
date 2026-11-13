// saveHybridQuizWeek (#85): refuses before touching the database when a verifier or the library says no.
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { LibraryExercise } from "@/lib/coach/verify";
import { saveHybridQuizWeek } from "./hybridQuiz";
import type { QuizProfileInput } from "./schema";

const verifyPlan = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/verify", async (original) => ({
  ...(await original<typeof import("@/lib/coach/verify")>()),
  verifyPlan,
}));

// Any use of the database fails the test: these paths must refuse first.
const untouchedDb = new Proxy(
  {},
  {
    get: () => {
      throw new Error("the database must not be used");
    },
  },
) as PrismaClient;

const quiz: QuizProfileInput = {
  goal: "GENERAL_FITNESS",
  level: "BEGINNER",
  trainingMode: "BOTH",
  daysPerWeek: 4,
  equipment: ["barbell"],
  injuries: "",
};
const planProfile = {
  daysPerWeek: 4,
  equipment: ["barbell"],
  avoidMuscles: [],
};
const exercise = (id: string, primary: string): LibraryExercise => ({
  id,
  equipment: "barbell",
  primaryMuscles: [primary],
  secondaryMuscles: [],
});
const library = [
  exercise("bench", "chest"),
  exercise("squat", "quadriceps"),
  exercise("row", "middle back"),
];

describe("saveHybridQuizWeek", () => {
  it("refuses with 'verify' when the strength days fail the verifier", async () => {
    verifyPlan.mockReturnValue({ ok: false, problems: ["too many sets"] });

    const result = await saveHybridQuizWeek(
      untouchedDb,
      "u1",
      quiz,
      planProfile,
      library,
    );

    expect(result).toEqual({ ok: false, reason: "verify" });
  });

  it("refuses with 'library' when there are too few exercises for the strength days", async () => {
    const result = await saveHybridQuizWeek(
      untouchedDb,
      "u1",
      quiz,
      planProfile,
      [exercise("bench", "chest")],
    );

    expect(result).toEqual({ ok: false, reason: "library" });
  });
});
