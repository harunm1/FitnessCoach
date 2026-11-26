// Tests for the D43 eval checks: every number in a reply comes from the user's data, the
// plan or the user's message; a reply never claims it cannot see data the app holds; and the
// 25 Nov message's case is answered from a seeded fixture with the import count and the trend.
import { describe, expect, it } from "vitest";
import { CHAT_CASES } from "./chatCases";
import {
  checkChatReply,
  claimsNoAccess,
  groundingSources,
  missingCites,
  ungroundedNumbers,
} from "./chatChecks";
import { prepareTurn } from "../src/lib/coach/chat";
import { REPLIES } from "../src/lib/coach/guardrails";

const reviewCase = CHAT_CASES.find((c) => c.id === "import-weight-review");
if (!reviewCase) throw new Error("the 25 Nov case is missing");
const sources = groundingSources(reviewCase.context, reviewCase.message);

const GOOD_REPLY =
  "You have 412 workouts imported from Hevy, from 14 Mar 2024 to 20 Nov 2026. " +
  "Over the last 90 days your weight went from 84.2 kg to 81 kg, down 3.2 kg, about 0.27 kg a week.";

describe("ungroundedNumbers (D43)", () => {
  it("passes a reply whose numbers all come from the data, dates by their parts", () => {
    expect(ungroundedNumbers(GOOD_REPLY, sources)).toEqual([]);
  });

  it("flags a number that is in no tool result", () => {
    expect(
      ungroundedNumbers("You lost 5 kg in the last 90 days.", sources),
    ).toEqual(["5"]);
  });

  it("reads thousands separators and trailing zeros as the same number", () => {
    expect(
      ungroundedNumbers("Volume was 1,860 kg and you weigh 81.0 kg.", [
        "Volume: 1860 kg.",
        "Latest: 81 kg.",
      ]),
    ).toEqual([]);
  });

  it("allows the plan's sets and reps and numbers the user typed", () => {
    expect(
      ungroundedNumbers("Do 3 x 5 today, as you asked for 2 sessions.", [
        "Bench Press 3 x 5",
        "Can I fit 2 sessions in?",
      ]),
    ).toEqual([]);
  });
});

describe("claimsNoAccess (D43)", () => {
  it.each([
    "I don't have access to your import history.",
    "I can't see your weight entries, so ask a trainer.",
    "I'm unable to view your logged data.",
    "I do not have access to your Hevy data.",
  ])("flags %s", (reply) => {
    expect(claimsNoAccess(reply)).toBe(true);
  });

  it("passes a reply that points to where the data is", () => {
    expect(
      claimsNoAccess("You can see the full trend on Progress, Weight."),
    ).toBe(false);
  });

  it("holds for every fixed reply of the app", () => {
    expect(Object.values(REPLIES).filter(claimsNoAccess)).toEqual([]);
  });
});

describe("the 25 Nov case (D43)", () => {
  it("reaches the model with the fixture's data in the prompt", async () => {
    const turn = await prepareTurn(reviewCase.context, [], reviewCase.message);
    expect(turn).toHaveProperty("messages");
    const system = "messages" in turn ? turn.messages[0].content : "";
    expect(system).toContain("412 workouts");
    expect(system).toContain("-3.2 kg over 84 days");
  });

  it("needs the import count and the weight change in the reply", () => {
    expect(missingCites(GOOD_REPLY, reviewCase.mustCite ?? [])).toEqual([]);
    expect(
      missingCites(
        "I don't have access to your import history or weight entries; see a trainer.",
        reviewCase.mustCite ?? [],
      ),
    ).toEqual(["412", "3.2"]);
  });

  it("fails the 25 Nov reply on every D43 check", () => {
    const live =
      "I don't have access to your import history or weight entries. A personal trainer can review them with you.";
    expect(checkChatReply(live, { ...reviewCase, sources }).sort()).toEqual([
      "claims-no-access",
      "missing-cite",
      "missing-period",
    ]);
    expect(checkChatReply(GOOD_REPLY, { ...reviewCase, sources })).toEqual([]);
    expect(
      checkChatReply(
        "You lost 5 kg in the last 90 days. You imported 412 workouts, 3.2 kg down.",
        { ...reviewCase, sources },
      ),
    ).toEqual(["ungrounded-number"]);
  });
});

describe("the reply names its period (D43, verifier S2)", () => {
  it("flags a reply to the 25 Nov case that gives the numbers but no period", () => {
    const noPeriod =
      "You have 412 workouts imported from Hevy, and your weight is down 3.2 kg.";
    expect(checkChatReply(noPeriod, { ...reviewCase, sources })).toEqual([
      "missing-period",
    ]);
    expect(checkChatReply(GOOD_REPLY, { ...reviewCase, sources })).toEqual([]);
  });

  it("reads a narrow no-break space as a space, as the 26 Nov Groq reply wrote '90 days'", () => {
    const live =
      "You imported 412 workouts. Over the past 90 days you are down 3.2 kg.";
    expect(checkChatReply(live, { ...reviewCase, sources })).toEqual([]);
  });
});
