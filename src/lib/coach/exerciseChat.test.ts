import { describe, expect, it } from "vitest";
import { buildExerciseChatMessages, readAssistantReply } from "./exerciseChat";

const exercise = {
  name: "Dumbbell Bench Press",
  equipment: "dumbbell",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps"],
  instructions: ["Lower the dumbbells with control."],
  cues: ["Keep wrists stacked over elbows."],
  commonMistakes: ["Do not bounce the weights."],
};

describe("buildExerciseChatMessages", () => {
  it("grounds prompts in the selected muscle and saved exercise content", () => {
    const messages = buildExerciseChatMessages(
      exercise,
      "chest",
      [{ role: "USER", content: "Where should I feel it?" }],
      "How do I keep my wrists aligned?",
    );

    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("Selected muscle area: chest");
    expect(messages[0]?.content).toContain("Lower the dumbbells with control.");
    expect(messages[0]?.content).toContain("Do not diagnose injuries");
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: "How do I keep my wrists aligned?",
    });
  });

  it("uses only the most recent eight conversation turns", () => {
    const history = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? ("USER" as const) : ("ASSISTANT" as const),
      content: `turn-${index}`,
    }));
    const messages = buildExerciseChatMessages(
      exercise,
      "chest",
      history,
      "next",
    );

    expect(messages).toHaveLength(10);
    expect(messages[1]?.content).toBe("turn-2");
  });
});

describe("readAssistantReply", () => {
  it("trims a provider reply", () => {
    expect(readAssistantReply("  Keep wrists neutral.  ")).toBe(
      "Keep wrists neutral.",
    );
  });

  it("rejects empty and oversized replies", () => {
    expect(readAssistantReply("  ")).toBeNull();
    expect(readAssistantReply("x".repeat(2001))).toBeNull();
  });
});
