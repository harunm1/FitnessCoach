// The per-call times an eval row records must not include the wait that paces the calls (#64).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LibraryExercise } from "../src/lib/coach/verify";
import { evalProfile, type EvalContext } from "./evalProfile";

const library: LibraryExercise[] = JSON.parse(
  readFileSync("eval/fixtures-library.json", "utf8"),
);

describe("evalProfile", () => {
  it("times each call without the pacing wait before it", async () => {
    const ctx: EvalContext = {
      model: async () => {
        throw new Error("groq returned HTTP 503");
      },
      // Each call is held for 80 ms before it starts, as the pacer would hold it.
      beforeCall: () => new Promise((resolve) => setTimeout(resolve, 80)),
      events: [],
      library,
      byId: new Map(library.map((e) => [e.id, e])),
    };

    const start = performance.now();
    const row = await evalProfile(ctx, "gym-3-days");
    const elapsed = performance.now() - start;

    // Two attempts, each held 80 ms: the wait happened, and no call's time holds it.
    expect(row.calls).toHaveLength(2);
    expect(elapsed).toBeGreaterThanOrEqual(160);
    for (const call of row.calls) expect(call.ms).toBeLessThan(80);
  });
});
