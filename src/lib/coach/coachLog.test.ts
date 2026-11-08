import { describe, expect, it, vi } from "vitest";
import {
  PLAN_PROMPT_VERSION,
  providerEventCollector,
  writeRecord,
  type CoachRecord,
} from "./coachLog";
import { generatePlan, type PlanModel } from "./generatePlan";
import { ProviderError, servedBy, withFallback, withRetry } from "./providers";
import type { VerifyProfile, CategorisedExercise } from "./verify";

const library: CategorisedExercise[] = ["bench", "squat"].map((id, i) => ({
  id,
  category: "strength",
  equipment: "barbell",
  primaryMuscles: [i === 0 ? "chest" : "quadriceps"],
  secondaryMuscles: [],
}));
const profile: VerifyProfile = {
  daysPerWeek: 1,
  equipment: ["barbell"],
  avoidMuscles: [],
};
const slot = (exerciseId: string) => ({
  exerciseId,
  sets: 3,
  reps: 10,
  restSeconds: 90,
});
const good = {
  name: "P",
  days: [{ name: "Full", exercises: [slot("bench"), slot("squat")] }],
};
const bad = {
  name: "P",
  days: [{ name: "Full", exercises: [slot("bench"), slot("bench")] }],
};

// A clock that moves 250 ms per reading, so latency is predictable.
const clock = () => {
  let t = 0;
  return () => (t += 250);
};

function run(model: PlanModel, takeProviderEvents?: () => never[]) {
  const records: CoachRecord[] = [];
  return generatePlan(model, profile, library, {
    log: (r) => {
      records.push(r);
    },
    takeProviderEvents,
    now: clock(),
  }).then((result) => ({ result, records }));
}

describe("coach log", () => {
  it("writes one ok record with the prompt version, latency and raw reply", async () => {
    const { records } = await run(vi.fn().mockResolvedValue(good));
    expect(records).toEqual([
      {
        kind: "plan",
        promptVersion: PLAN_PROMPT_VERSION,
        attempt: 1,
        latencyMs: 250,
        outcome: "ok",
        providerEvents: [],
        raw: good,
      },
    ]);
  });

  it("records a verifier rejection with its problems, then the retried success", async () => {
    const model = vi
      .fn<PlanModel>()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(good);
    const { records } = await run(model);
    expect(records.map((r) => r.outcome)).toEqual(["rejected", "retried"]);
    expect(records[0].problems?.[0]).toMatch(/appears twice/);
  });

  it("records errors and the rule-based fallback when no reply works", async () => {
    const { result, records } = await run(
      vi.fn().mockRejectedValue(new Error("rate limited")),
    );
    expect(result.source).toBe("DEFAULT");
    expect(records.map((r) => r.outcome)).toEqual([
      "error",
      "error",
      "rule_based",
    ]);
    expect(records[0].error).toBe("rate limited");
  });

  it("marks a plan served after a provider switch as switched", async () => {
    const collector = providerEventCollector();
    const groq = vi
      .fn<PlanModel>()
      .mockRejectedValue(new ProviderError("rate limited", "Groq", 429));
    const gemini = vi.fn<PlanModel>().mockResolvedValue(good);
    const model = withFallback(
      withRetry(groq, { retries: 0, onEvent: collector.onEvent }),
      servedBy(gemini, "Gemini", "gemini-test", collector.onEvent),
      collector.onEvent,
    );
    const records: CoachRecord[] = [];
    await generatePlan(model, profile, library, {
      log: (r) => {
        records.push(r);
      },
      takeProviderEvents: collector.take,
    });
    expect(records[0]).toMatchObject({
      outcome: "switched",
      provider: "Gemini",
      model: "gemini-test",
      providerEvents: [{ provider: "Groq", action: "fallback", status: 429 }],
    });
  });

  it("names the provider and model when a reply came back but was not JSON", async () => {
    const collector = providerEventCollector();
    const groq = vi
      .fn<PlanModel>()
      .mockRejectedValue(new Error("Groq reply was not valid JSON"));
    const records: CoachRecord[] = [];
    await generatePlan(
      servedBy(groq, "Groq", "groq-test", collector.onEvent),
      profile,
      library,
      {
        log: (r) => {
          records.push(r);
        },
        takeProviderEvents: collector.take,
      },
    );
    expect(records[0]).toMatchObject({
      outcome: "error",
      provider: "Groq",
      model: "groq-test",
      providerEvents: [],
    });
  });

  it("never lets a failing sink break the request", async () => {
    await expect(
      writeRecord(
        () => {
          throw new Error("db down");
        },
        {
          kind: "plan",
          promptVersion: PLAN_PROMPT_VERSION,
          attempt: 1,
          latencyMs: 1,
          outcome: "ok",
          providerEvents: [],
        },
      ),
    ).resolves.toBeUndefined();
  });
});
