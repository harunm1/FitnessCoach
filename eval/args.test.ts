// Command-line parsing for eval/coachEval.ts: positionals with and without the repeat flags.
import { describe, expect, it } from "vitest";
import { parseArgs } from "./args";

describe("parseArgs", () => {
  it("reads mode, label and profile list as before", () => {
    expect(parseArgs(["gemini", "round2", "gym-3-days,home-2-days"])).toEqual({
      mode: "gemini",
      label: "round2",
      only: ["gym-3-days", "home-2-days"],
    });
  });

  it("defaults to Groq and the label run", () => {
    expect(parseArgs([])).toEqual({ mode: "groq", label: "run" });
  });

  it("keeps the positionals when flags come first or between them", () => {
    expect(
      parseArgs([
        "--repeat",
        "5",
        "groq",
        "repeat",
        "--file",
        "a.jsonl",
        "gym-3-days",
      ]),
    ).toEqual({
      mode: "groq",
      label: "repeat",
      only: ["gym-3-days"],
      repeat: 5,
      file: "a.jsonl",
    });
  });

  it("rejects a repeat count that is not a positive whole number", () => {
    expect(() => parseArgs(["groq", "r", "--repeat", "five"])).toThrow(
      /--repeat/,
    );
    expect(() => parseArgs(["groq", "r", "--repeat"])).toThrow(/--repeat/);
  });

  it("rejects the --flag=value form instead of misreading it", () => {
    expect(() => parseArgs(["groq", "--repeat=5"])).toThrow(/--repeat 5/);
  });
});
