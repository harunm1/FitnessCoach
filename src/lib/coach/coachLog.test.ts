import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLAN_PROMPT_VERSION,
  providerEventCollector,
  writeRecord,
  type CoachRecord,
} from "./coachLog";
import { generatePlan, type PlanModel } from "./generatePlan";
import {
  coachModel,
  ProviderError,
  servedBy,
  withFallback,
  withRetry,
} from "./providers";
import type { LibraryExercise, VerifyProfile } from "./verify";

const library: LibraryExercise[] = ["bench", "squat"].map((id, i) => ({
  id,
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
        inputTokens: null,
        outputTokens: null,
        guardrailVerdict: null,
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
          inputTokens: null,
          outputTokens: null,
          guardrailVerdict: null,
        },
      ),
    ).resolves.toBeUndefined();
  });
});

// The real provider chain with fetch mocked: the token counts in a record are the
// ones the provider's response carried (#41).
const KEY = "test-key-not-real";
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const groqReply = (content: unknown, usage?: unknown) => ({
  choices: [{ message: { content: JSON.stringify(content) } }],
  ...(usage === undefined ? {} : { usage }),
});
const geminiReply = (content: unknown, usageMetadata?: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(content) }] } }],
  ...(usageMetadata === undefined ? {} : { usageMetadata }),
});

function runChain(
  env: Record<string, string>,
  replies: Response[],
  options: { guardrailVerdict?: string | null } = {},
) {
  const fetchMock = vi.fn();
  for (const reply of replies) fetchMock.mockResolvedValueOnce(reply);
  vi.stubGlobal("fetch", fetchMock);
  const collector = providerEventCollector();
  const records: CoachRecord[] = [];
  return generatePlan(
    coachModel(env, { retries: 0, onEvent: collector.onEvent }),
    profile,
    library,
    {
      log: (r) => {
        records.push(r);
      },
      takeProviderEvents: collector.take,
      ...options,
    },
  ).then(() => records);
}

describe("coach log token counts and guardrail verdict", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records the prompt and completion tokens Groq reports", async () => {
    const records = await runChain({ GROQ_API_KEY: KEY }, [
      answer(
        groqReply(good, {
          prompt_tokens: 1200,
          completion_tokens: 340,
          total_tokens: 1540,
        }),
      ),
    ]);
    expect(records[0]).toMatchObject({
      outcome: "ok",
      provider: "Groq",
      inputTokens: 1200,
      outputTokens: 340,
      providerEvents: [],
    });
  });

  it("counts Gemini's thinking tokens as output tokens, as it bills them", async () => {
    const records = await runChain(
      { COACH_PROVIDER: "gemini", GEMINI_API_KEY: KEY },
      [
        answer(
          geminiReply(good, {
            promptTokenCount: 900,
            candidatesTokenCount: 300,
            thoughtsTokenCount: 120,
            totalTokenCount: 1320,
          }),
        ),
      ],
    );
    expect(records[0]).toMatchObject({
      provider: "Gemini",
      inputTokens: 900,
      outputTokens: 420,
    });
  });

  it("records null tokens when the response carries no usage", async () => {
    const records = await runChain({ GROQ_API_KEY: KEY }, [
      answer(groqReply(good)),
    ]);
    expect(records[0]).toMatchObject({
      outcome: "ok",
      inputTokens: null,
      outputTokens: null,
    });
  });

  it("records null for a count the provider sent in a form that is not a count", async () => {
    const records = await runChain({ GROQ_API_KEY: KEY }, [
      answer(groqReply(good, { prompt_tokens: "1200", completion_tokens: -5 })),
    ]);
    expect(records[0]).toMatchObject({ inputTokens: null, outputTokens: null });
  });

  it("keeps the tokens of a reply that came back but was not valid JSON", async () => {
    const records = await runChain({ GROQ_API_KEY: KEY }, [
      answer({
        choices: [{ message: { content: "Sure! Here is your plan" } }],
        usage: { prompt_tokens: 800, completion_tokens: 25 },
      }),
      answer(groqReply(good, { prompt_tokens: 830, completion_tokens: 310 })),
    ]);
    expect(records.map((r) => r.outcome)).toEqual(["error", "retried"]);
    expect(records[0]).toMatchObject({ inputTokens: 800, outputTokens: 25 });
    expect(records[1]).toMatchObject({ inputTokens: 830, outputTokens: 310 });
  });

  it("takes the tokens from the provider that answered after a switch", async () => {
    const records = await runChain({ GROQ_API_KEY: KEY, GEMINI_API_KEY: KEY }, [
      answer({ error: "rate limited" }, 429),
      answer(
        geminiReply(good, { promptTokenCount: 700, candidatesTokenCount: 200 }),
      ),
    ]);
    expect(records[0]).toMatchObject({
      outcome: "switched",
      provider: "Gemini",
      inputTokens: 700,
      outputTokens: 200,
    });
    expect(records[0].providerEvents).toEqual([
      { provider: "Groq", action: "fallback", status: 429 },
    ]);
  });

  it("records null tokens when no provider answered, and on the rule-based record", async () => {
    const { records } = await run(
      vi.fn().mockRejectedValue(new Error("rate limited")),
    );
    expect(records.map((r) => [r.inputTokens, r.outputTokens])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("records no guardrail verdict by default", async () => {
    const { records } = await run(vi.fn().mockResolvedValue(good));
    expect(records[0].guardrailVerdict).toBeNull();
  });

  it("carries the guardrail verdict it is given on every record of the call", async () => {
    const records: CoachRecord[] = [];
    await generatePlan(
      vi.fn<PlanModel>().mockResolvedValueOnce(bad).mockResolvedValueOnce(good),
      profile,
      library,
      {
        log: (r) => {
          records.push(r);
        },
        guardrailVerdict: "ALLOW",
      },
    );
    expect(records.map((r) => r.guardrailVerdict)).toEqual(["ALLOW", "ALLOW"]);
  });
});
