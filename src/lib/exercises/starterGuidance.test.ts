// #193: every exercise a starter plan or template program can show has form guidance.
// The session page shows "Form guidance" only when the stored cues or common mistakes
// are not empty, so an exercise with neither shows nothing (live: Barbell Side Split
// Squat, Alternating Hang Clean, Ab Crunch Machine). The guidance is what the seed
// stores, computed here from the dataset's instructions (a snapshot of the rows the
// starter plans can reach, prisma/data/exercise-instructions-snapshot.json).
import { describe, expect, it } from "vitest";
import snapshot from "../../../prisma/data/exercise-instructions-snapshot.json";
import { guidanceForExercise } from "../../../prisma/exerciseGuidanceData";
import { hasGuidance } from "./guidance";
import { loadFixtureLibrary, starterPlanExerciseIds } from "./starterPlanIds";

const MIN_IDS = 30;
const ids = starterPlanExerciseIds(loadFixtureLibrary());
const instructionsOf = (id: string): readonly string[] =>
  Object.hasOwn(snapshot, id) ? snapshot[id as keyof typeof snapshot] : [];

describe("form guidance for starter plan exercises (#193)", () => {
  it("finds the exercises the starter plans and templates use", () => {
    expect(ids.length).toBeGreaterThan(MIN_IDS);
  });

  it("gives every one of them cues or common mistakes", () => {
    const without = ids.filter(
      (id) => !hasGuidance(guidanceForExercise(id, instructionsOf(id))),
    );
    expect(without).toEqual([]);
  });

  it.each([
    "Barbell_Side_Split_Squat",
    "Alternating_Hang_Clean",
    "Ab_Crunch_Machine",
  ])("gives %s, from the live report, its dataset steps", (id) => {
    const guidance = guidanceForExercise(id, instructionsOf(id));
    expect(guidance.cues.length).toBeGreaterThan(0);
    expect(guidance.cues).toEqual(instructionsOf(id).map((s) => s.trim()));
  });
});
