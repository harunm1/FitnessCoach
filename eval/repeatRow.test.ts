// Which repeat rows count, and how a stored row becomes a consistency input (#64).
import { describe, expect, it } from "vitest";
import { firstCallAnswered, parseDoneRuns, toRepeatRun } from "./repeatRow";

const plan = { name: "Plan", days: [] };

describe("firstCallAnswered", () => {
  it("is true when the first call returned a reply, passing or not", () => {
    expect(firstCallAnswered([{ ms: 900, reply: plan, problems: ["x"] }])).toBe(
      true,
    );
  });

  it("is false when the first call failed in transport, even if a later one answered", () => {
    expect(
      firstCallAnswered([
        { ms: 70, error: "groq returned HTTP 429" },
        { ms: 900, reply: plan, problems: [] },
      ]),
    ).toBe(false);
    expect(firstCallAnswered([])).toBe(false);
  });
});

describe("toRepeatRun", () => {
  it("takes the first call's reply and time", () => {
    const row = {
      firstReplyPassed: false,
      calls: [
        { ms: 900, reply: plan, problems: ["day 1: not in the library"] },
        { ms: 1100, reply: { other: true }, problems: [] },
      ],
    };

    expect(toRepeatRun(row)).toEqual({
      firstReplyPassed: false,
      reply: plan,
      ms: 900,
    });
  });

  it("gives no reply and no time when the first call failed", () => {
    const row = {
      firstReplyPassed: false,
      calls: [{ ms: 70, error: "HTTP 503" }],
    };

    expect(toRepeatRun(row)).toEqual({
      firstReplyPassed: false,
      reply: null,
      ms: null,
    });
  });
});

describe("parseDoneRuns", () => {
  it("reads the profile and run of each recorded line", () => {
    const text = '{"run":1,"id":"a","calls":[]}\n{"run":2,"id":"a"}\n';

    expect(parseDoneRuns(text)).toEqual([
      { id: "a", run: 1 },
      { id: "a", run: 2 },
    ]);
  });

  it("is empty for an empty file", () => {
    expect(parseDoneRuns("")).toEqual([]);
  });
});
