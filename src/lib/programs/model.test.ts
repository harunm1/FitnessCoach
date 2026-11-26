// Which model adapts a program (D38): the coach's providers, or a fixed reply for the
// browser test. The fixed reply is never used on Vercel.
import { describe, expect, it } from "vitest";
import { programModel } from "./model";

const reply = { changes: [] };

describe("programModel", () => {
  it("answers with the test reply when PROGRAM_MODEL_STUB is set off Vercel", async () => {
    const model = programModel({ PROGRAM_MODEL_STUB: JSON.stringify(reply) });
    await expect(model("prompt")).resolves.toEqual(reply);
  });

  it("ignores the test reply on Vercel", async () => {
    const model = programModel({
      PROGRAM_MODEL_STUB: JSON.stringify(reply),
      VERCEL: "1",
    });
    // No provider key in this env, so the real chain cannot be built: the call fails
    // and the adapter falls back to the template.
    await expect(model("prompt")).rejects.toThrow(/GROQ_API_KEY/);
  });

  it("fails the call, rather than the page, when no provider key is set", async () => {
    await expect(programModel({})("prompt")).rejects.toThrow(/GROQ_API_KEY/);
  });
});
