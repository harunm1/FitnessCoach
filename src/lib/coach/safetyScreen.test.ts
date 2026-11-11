// Tests for the layered safety screen (D15): the model check can raise the response, never lower the word list.
import { describe, expect, it, vi } from "vitest";
import { REPLIES } from "./guardrails";
import {
  screenUserMessage,
  screenUserMessageWithReading,
  type SafetyClassifier,
} from "./safetyScreen";

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
      // A well-behaved classifier drops its own work on abort, so any timer still
      // counted after the timeout path belongs to the screen (10 November review).
      const slow: SafetyClassifier = (_text, signal) =>
        new Promise((resolve) => {
          const own = setTimeout(() => resolve("NONE"), 60_000);
          signal?.addEventListener("abort", () => {
            aborted = true;
            clearTimeout(own);
          });
        });
      const pending = screenUserMessage("how many sets today?", slow, {
        timeoutMs: 3000,
      });
      await vi.advanceTimersByTimeAsync(3000);
      await pending;
      expect(aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      await screenUserMessage("how many sets today?", says("NONE"));
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

// The screen used to turn every model failure into "no reading" with nothing to show
// it; a caller can now count and log the times the model did not run (10 November
// blind review).
describe("screenUserMessageWithReading", () => {
  const MODEL_LIMIT = 4000;

  it.each([
    [
      "a classifier that throws",
      (() => Promise.reject(new Error("HTTP 503"))) as SafetyClassifier,
    ],
    [
      "a classifier that returns an unknown label",
      (async () => "MAYBE") as unknown as SafetyClassifier,
    ],
  ])(
    "reports the model as unavailable for %s and keeps the word-list result",
    async (_name, classify) => {
      const result = await screenUserMessageWithReading(
        "I want to die",
        classify,
      );
      expect(result).toEqual({
        guard: { action: "CRISIS", reply: REPLIES.CRISIS },
        model: "UNAVAILABLE",
      });
    },
  );

  it("reports the model as not configured when there is no classifier", async () => {
    const result = await screenUserMessageWithReading("how many sets today?");
    expect(result).toEqual({
      guard: { action: "ALLOW" },
      model: "NOT_CONFIGURED",
    });
  });

  it("reports the category the model read", async () => {
    const result = await screenUserMessageWithReading(
      "honestly what is even the point anymore",
      says("DISTRESS"),
    );
    expect(result.model).toBe("DISTRESS");
    expect(result.guard.action).toBe("CHECK_IN");
  });

  it("sends the model at most a bounded slice of a very long message", async () => {
    let seen = "";
    const record: SafetyClassifier = async (text) => {
      seen = text;
      return "NONE";
    };
    // Two characters per repeat, so twice the limit.
    const long = "x ".repeat(MODEL_LIMIT);
    await screenUserMessageWithReading(long, record);
    expect(seen).toBe(long.slice(0, MODEL_LIMIT));
  });

  it("reads the normalized text, so invisible padding cannot hide the message from the model", async () => {
    let seen = "";
    const record: SafetyClassifier = async (text) => {
      seen = text;
      return "NONE";
    };
    await screenUserMessageWithReading(
      "​".repeat(MODEL_LIMIT) + "I feel like disappearing",
      record,
    );
    expect(seen).toBe("I feel like disappearing");
  });
});
