import { describe, expect, it } from "vitest";
import { QUICK_REPLIES } from "@/components/coach/QuickReplies";
import { CHAT_PROMPT_VERSION } from "./chat";
import {
  DEMO_REPLY_CACHE,
  chatPromptFingerprint,
  demoReplyFor,
  demoReplyKey,
} from "./demoReplies";
import { checkCoachReply } from "./guardrails";

const DEMO = { COACH_DEMO_MODE: "1" };

describe("demo reply cache file (D12, #59)", () => {
  it("was written by the current chat prompt, version and wording", () => {
    // A prompt change without a refresh (scripts/demo-replies.ts) fails here.
    expect(DEMO_REPLY_CACHE.promptVersion).toBe(CHAT_PROMPT_VERSION);
    expect(DEMO_REPLY_CACHE.promptFingerprint).toBe(chatPromptFingerprint());
  });

  it("holds one stored reply for every quick reply on the chat screen", () => {
    const keys = DEMO_REPLY_CACHE.replies.map((r) => demoReplyKey(r.question));
    expect(keys).toEqual(
      expect.arrayContaining(QUICK_REPLIES.map((quick) => demoReplyKey(quick))),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("stores only replies that pass the reply check, with the model that wrote them", () => {
    const entries = DEMO_REPLY_CACHE.replies;
    expect(entries.map((e) => e.reply.trim() !== "")).not.toContain(false);
    expect(entries.map((e) => checkCoachReply(e.reply).action)).toEqual(
      entries.map(() => "ALLOW"),
    );
    expect(entries.map((e) => e.model.trim() !== "")).not.toContain(false);
    // A calendar date such as "2026-11-24"; "24 Nov" is refused.
    // https://regex101.com/?regex=%5E%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7D%24&testString=2026-11-24
    expect(DEMO_REPLY_CACHE.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("demoReplyKey", () => {
  it("ignores case, outer spaces and repeated spaces only", () => {
    expect(demoReplyKey("  Swap   THIS exercise ")).toBe("swap this exercise");
    expect(demoReplyKey("Swap this exercise?")).not.toBe(
      demoReplyKey("Swap this exercise"),
    );
  });
});

describe("demoReplyFor", () => {
  const stored = DEMO_REPLY_CACHE.replies[0];

  it("returns the stored reply for a scripted question in demo mode", () => {
    expect(demoReplyFor(stored.question, DEMO)).toBe(stored.reply);
    expect(demoReplyFor(` ${stored.question.toUpperCase()} `, DEMO)).toBe(
      stored.reply,
    );
  });

  it.each([{}, { COACH_DEMO_MODE: "" }, { COACH_DEMO_MODE: "0" }])(
    "returns nothing outside demo mode (%o)",
    (env) => {
      expect(demoReplyFor(stored.question, env)).toBeUndefined();
    },
  );

  it("returns nothing for a question that is not scripted, even a close one", () => {
    expect(demoReplyFor("Can I swap squats for lunges?", DEMO)).toBeUndefined();
    expect(demoReplyFor(`${stored.question} today`, DEMO)).toBeUndefined();
    expect(demoReplyFor("", DEMO)).toBeUndefined();
  });
});
