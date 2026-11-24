// Tests for the chat reply checks (#142): a reply is too long when it runs past 80 words
// or 4 sentences, and carries an unrequested notice when it mentions recovery, pain or
// nutrition although the user's message did not raise that topic.
import { describe, expect, it } from "vitest";
import { CHAT_CASES } from "./chatCases";
import {
  checkChatReply,
  MAX_REPLY_SENTENCES,
  MAX_REPLY_WORDS,
} from "./chatChecks";
import { CHAT_PROMPT_VERSION, prepareTurn } from "../src/lib/coach/chat";

const words = (count: number) => Array(count).fill("word").join(" ");

// Rebuilt from the three lines quoted in #142 (recovery, joint pain, nutrition) around a
// short floor-press answer. It is not the recorded reply, which the issue does not keep.
const FLOOR_PRESS_REPLY =
  "Yes, floor press works as a bench swap: keep the same sets and reps. " +
  "Aim for 48 h of light activity between pressing days to recover. " +
  "If you feel joint pain, stop and see a professional. " +
  "Keep your protein up so the muscle can grow.";

describe("checkChatReply: length", () => {
  it("passes a reply at the word and sentence limits", () => {
    const reply = `${words(MAX_REPLY_WORDS - 3)}. Two. Three. Four.`;
    expect(MAX_REPLY_SENTENCES).toBe(4);
    expect(checkChatReply(reply, { raises: [] })).toEqual([]);
  });

  it("flags one word over the limit", () => {
    const reply = `${words(MAX_REPLY_WORDS + 1)}.`;
    expect(checkChatReply(reply, { raises: [] })).toEqual(["too-many-words"]);
  });

  it("flags a fifth sentence", () => {
    const reply = "One. Two. Three. Four. Five.";
    expect(checkChatReply(reply, { raises: [] })).toEqual([
      "too-many-sentences",
    ]);
  });

  it("does not count a decimal point as a sentence end", () => {
    const reply = "Add 2.5 kg. Keep 2 reps in reserve. Rest 2.5 minutes.";
    expect(checkChatReply(reply, { raises: [] })).toEqual([]);
  });

  it("lifts the length cap when the user asked for detail", () => {
    const reply = `${words(MAX_REPLY_WORDS * 2)}. One. Two. Three. Four. Five.`;
    expect(checkChatReply(reply, { raises: [], detail: true })).toEqual([]);
  });
});

describe("checkChatReply: unrequested notices", () => {
  it("flags the recovery, pain and nutrition lines in the 22 November reply", () => {
    expect(checkChatReply(FLOOR_PRESS_REPLY, { raises: [] })).toEqual([
      "unrequested-recovery",
      "unrequested-pain",
      "unrequested-nutrition",
    ]);
  });

  it("passes a plain answer with no notice", () => {
    const reply =
      "Floor press is a fair swap for bench today. Keep the plan's sets and reps. Pause your triceps on the floor each rep.";
    expect(checkChatReply(reply, { raises: [] })).toEqual([]);
  });

  it("allows a notice for the topic the user raised, and only that one", () => {
    expect(checkChatReply(FLOOR_PRESS_REPLY, { raises: ["pain"] })).toEqual([
      "unrequested-recovery",
      "unrequested-nutrition",
    ]);
    expect(
      checkChatReply(FLOOR_PRESS_REPLY, {
        raises: ["recovery", "pain", "nutrition"],
      }),
    ).toEqual([]);
  });

  it("reads a notice case-insensitively", () => {
    expect(checkChatReply("Eat more PROTEIN.", { raises: [] })).toEqual([
      "unrequested-nutrition",
    ]);
  });

  it("does not flag rest between sets, which the plan itself gives", () => {
    expect(
      checkChatReply("Rest 90 seconds between sets.", { raises: [] }),
    ).toEqual([]);
  });
});

describe("CHAT_CASES", () => {
  it("has unique ids", () => {
    const ids = CHAT_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the 22 November floor-press question with no topic raised", () => {
    const floorPress = CHAT_CASES.find((c) => c.id === "floor-press-swap");
    expect(floorPress?.raises).toEqual([]);
  });

  it("has a case for each topic and one that asks for detail", () => {
    const raised = new Set(CHAT_CASES.flatMap((c) => c.raises));
    expect([...raised].sort()).toEqual(["nutrition", "pain", "recovery"]);
    expect(CHAT_CASES.some((c) => c.detail)).toBe(true);
  });

  it("sends each model case to the model, not to a fixed guardrail reply", async () => {
    for (const c of CHAT_CASES.filter((x) => x.reachesModel)) {
      const turn = await prepareTurn(c.context, [], c.message);
      expect(turn, c.id).toHaveProperty("messages");
    }
  });

  it("is checked against the version of the prompt it was written for", () => {
    expect(CHAT_PROMPT_VERSION).toBe("chat-v5");
  });
});
