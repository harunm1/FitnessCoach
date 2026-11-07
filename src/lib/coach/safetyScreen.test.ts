// Tests for the layered safety screen (D15): the model check can raise the response, never lower the word list.
import { describe, expect, it, vi } from "vitest";
import { REPLIES } from "./guardrails";
import { screenUserMessage, type SafetyClassifier } from "./safetyScreen";

const says =
  (category: Awaited<ReturnType<SafetyClassifier>>): SafetyClassifier =>
  async () =>
    category;

describe("screenUserMessage", () => {
  it("raises to the crisis reply when the model reads intent the word list misses", async () => {
    const guard = await screenUserMessage(
      "I've been feeling like there's no way out",
      says("CRISIS"),
    );
    expect(guard).toEqual({ action: "CRISIS", reply: REPLIES.CRISIS });
  });

  it("raises to the red-flag reply on a medical reading", async () => {
    const guard = await screenUserMessage(
      "something feels very wrong with my heart",
      says("MEDICAL"),
    );
    expect(guard.action).toBe("RED_FLAG");
  });

  it("raises to the check-in on a distress reading", async () => {
    const guard = await screenUserMessage(
      "honestly what is even the point anymore",
      says("DISTRESS"),
    );
    expect(guard).toEqual({ action: "CHECK_IN", reply: REPLIES.CHECK_IN });
  });

  it("never lowers what the word list finds", async () => {
    expect(
      (await screenUserMessage("I want to die", says("NONE"))).action,
    ).toBe("CRISIS");
    expect(
      (
        await screenUserMessage(
          "chest pain on the last interval",
          says("DISTRESS"),
        )
      ).action,
    ).toBe("RED_FLAG");
  });

  it("uses the word list alone when the model fails", async () => {
    const failing: SafetyClassifier = async () => {
      throw new Error("groq returned HTTP 503");
    };
    expect((await screenUserMessage("I want to die", failing)).action).toBe(
      "CRISIS",
    );
    expect(
      (await screenUserMessage("how many sets of squats today?", failing))
        .action,
    ).toBe("ALLOW");
  });

  it("does not wait past the time limit for a slow model", async () => {
    vi.useFakeTimers();
    try {
      const slow: SafetyClassifier = () =>
        new Promise((resolve) => setTimeout(() => resolve("CRISIS"), 60_000));
      const pending = screenUserMessage(
        "how many sets of squats today?",
        slow,
        {
          timeoutMs: 3000,
        },
      );
      await vi.advanceTimersByTimeAsync(3000);
      expect((await pending).action).toBe("ALLOW");
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the word list alone with no model configured", async () => {
    expect((await screenUserMessage("I took 20 pills")).action).toBe("CRISIS");
    expect((await screenUserMessage("what pace for my easy run?")).action).toBe(
      "ALLOW",
    );
  });

  it("leaves an ordinary message alone when the model sees nothing", async () => {
    expect(
      (await screenUserMessage("can I swap bench for push-ups?", says("NONE")))
        .action,
    ).toBe("ALLOW");
  });

  it("skips the model for an empty message", async () => {
    const classify = vi.fn<SafetyClassifier>();
    await screenUserMessage("   ", classify);
    expect(classify).not.toHaveBeenCalled();
  });
});

describe("screenUserMessage keeps every floor reply the model does not outrank", () => {
  it("keeps eating support when the model reads distress", async () => {
    const guard = await screenUserMessage(
      "I make myself throw up after big meals",
      says("DISTRESS"),
    );
    expect(guard.action).toBe("EATING_SUPPORT");
  });

  it("keeps the pain stop when the model reads distress", async () => {
    const guard = await screenUserMessage(
      "sharp pain in my knee on squats",
      says("DISTRESS"),
    );
    expect(guard.action).toBe("PAIN_STOP");
  });

  it("lets crisis and medical readings outrank them", async () => {
    expect(
      (
        await screenUserMessage(
          "sharp pain in my knee on squats",
          says("CRISIS"),
        )
      ).action,
    ).toBe("CRISIS");
    expect(
      (
        await screenUserMessage(
          "sharp pain in my knee on squats",
          says("MEDICAL"),
        )
      ).action,
    ).toBe("RED_FLAG");
  });

  it("falls back to the word list when the classifier throws at once", async () => {
    const broken: SafetyClassifier = () => {
      throw new Error("not async");
    };
    expect((await screenUserMessage("I want to die", broken)).action).toBe(
      "CRISIS",
    );
  });

  it("cancels the model request and leaves no timer behind", async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const slow: SafetyClassifier = (_text, signal) =>
        new Promise((resolve) => {
          signal?.addEventListener("abort", () => {
            aborted = true;
          });
          setTimeout(() => resolve("NONE"), 60_000);
        });
      const pending = screenUserMessage("how many sets today?", slow, {
        timeoutMs: 3000,
      });
      await vi.advanceTimersByTimeAsync(3000);
      await pending;
      expect(aborted).toBe(true);
      vi.clearAllTimers();
      await screenUserMessage("how many sets today?", says("NONE"));
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
