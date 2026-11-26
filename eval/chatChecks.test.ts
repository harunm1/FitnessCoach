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

// Built around the one line #142 quotes ("aim for 48 h of light activity"); the pain and
// nutrition lines are written to match the issue's description of them. It is not the
// recorded reply, which the issue does not keep.
const FLOOR_PRESS_REPLY =
  "Yes, floor press works as a bench swap: keep the same sets and reps. " +
  "Aim for 48 h of light activity between pressing days to recover. " +
  "If you feel joint pain, stop and see a professional. " +
  "Keep your protein up so the muscle can grow.";

describe("checkChatReply: length", () => {
  it("passes a reply one word under the limit and at four sentences", () => {
    const reply = `${words(MAX_REPLY_WORDS - 4)}. Two. Three. Four.`;
    expect(MAX_REPLY_SENTENCES).toBe(4);
    expect(checkChatReply(reply, { raises: [] })).toEqual([]);
  });

  it("flags a reply of 80 words, since the prompt says under 80", () => {
    const reply = `${words(MAX_REPLY_WORDS - 1)}.`;
    expect(checkChatReply(reply, { raises: [] })).toEqual([]);
    expect(
      checkChatReply(`${words(MAX_REPLY_WORDS)}.`, { raises: [] }),
    ).toEqual(["too-many-words"]);
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

  it.each([
    "Rest a day between sessions.",
    "Take a rest day tomorrow to let your muscles bounce back.",
    "Take a deload week if you feel beat up.",
    "Mind the soreness tomorrow.",
    "Ice your elbow afterward.",
  ])("flags the recovery wording %j", (reply) => {
    expect(checkChatReply(reply, { raises: [] })).toEqual([
      "unrequested-recovery",
    ]);
  });

  it.each([
    "If it hurts, stop.",
    "Some discomfort is normal, but consult a doctor.",
  ])("flags the pain wording %j", (reply) => {
    expect(checkChatReply(reply, { raises: [] })).toEqual(["unrequested-pain"]);
  });

  it.each([
    "Fuel up before training and eat well.",
    "Eat enough food so you can grow.",
    "Stay hydrated and drink water.",
    "Make sure you're eating enough carbs.",
  ])("flags the nutrition wording %j", (reply) => {
    expect(checkChatReply(reply, { raises: [] })).toEqual([
      "unrequested-nutrition",
    ]);
  });

  it.each([
    "Train within 2 hours of waking if you like.",
    "Hold 2 h before you train.",
    "Rest 90 seconds between sets.",
    "Tuesday and Thursday are rest days.",
    "Week 4 is a deload.",
    "It won't hurt to add a set.",
    "Consult the plan for today's loads.",
    "Keep your elbows tucked and the bar close.",
  ])("does not flag ordinary coaching: %j", (reply) => {
    expect(checkChatReply(reply, { raises: [] })).toEqual([]);
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

  it("answers the cases marked as guardrail ones with a fixed reply", async () => {
    const fixed = CHAT_CASES.filter((x) => !x.reachesModel);
    expect(fixed.length).toBeGreaterThan(0);
    await Promise.all(
      fixed.map(async (c) => {
        const turn = await prepareTurn(c.context, [], c.message);
        expect(turn, c.id).toHaveProperty("fixed");
      }),
    );
  });

  it("sends each model case to the model, not to a fixed guardrail reply", async () => {
    for (const c of CHAT_CASES.filter((x) => x.reachesModel)) {
      const turn = await prepareTurn(c.context, [], c.message);
      expect(turn, c.id).toHaveProperty("messages");
    }
  });

  it("is checked against the version of the prompt it was written for", () => {
    expect(CHAT_PROMPT_VERSION).toBe("chat-v6");
  });
});
