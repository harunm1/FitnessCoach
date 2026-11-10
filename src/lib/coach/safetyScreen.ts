// Layered safety screen for one user message (D15): the model check, the word-list floor and the check-in.
// The model check starts first and reads meaning; the word list (guardrails.ts, with
// the check-in from distress.ts) is the deterministic floor. The model can only raise
// the response, to the check-in, the red-flag reply or the crisis reply; it never
// lowers what the word list finds. If the model is not configured, fails or is slow,
// the word list decides alone, so a provider outage never weakens the floor.
import { REPLIES, checkUserMessage, type Guard } from "./guardrails";

export type SafetyCategory = "CRISIS" | "MEDICAL" | "DISTRESS" | "NONE";
// The signal aborts the request when the screen stops waiting.
export type SafetyClassifier = (
  text: string,
  signal?: AbortSignal,
) => Promise<SafetyCategory>;

// Long enough for one short classification on Groq, short enough not to stall a chat
// reply; past it the word list decides.
export const SAFETY_TIMEOUT_MS = 3000;

const FROM_MODEL: Record<Exclude<SafetyCategory, "NONE">, Guard> = {
  CRISIS: { action: "CRISIS", reply: REPLIES.CRISIS },
  MEDICAL: { action: "RED_FLAG", reply: REPLIES.RED_FLAG },
  DISTRESS: { action: "CHECK_IN", reply: REPLIES.CHECK_IN },
};

// A floor reply that already gives specific help (eating support with NEDIC, a pain
// stop, a reframe, no diagnosis) ranks with the check-in, so a distress reading never
// replaces it; only a crisis or medical reading outranks it.
function severity(guard: Guard): number {
  switch (guard.action) {
    case "CRISIS":
      return 3;
    case "RED_FLAG":
      return 2;
    case "CHECK_IN":
    case "EATING_SUPPORT":
    case "PAIN_STOP":
    case "MINDSET_REFRAME":
    case "NO_DIAGNOSIS":
      return 1;
    // Plain redirects and guidance, no safety content: any model reading outranks them.
    case "PAIN_GUIDANCE":
    case "NUTRITION_REDIRECT":
    case "OFF_TOPIC":
    case "ALLOW":
      return 0;
  }
}

// Runs the classifier with a time limit; past it the request is aborted. A classifier
// that throws at once is treated like one that fails later.
function readWithinTime(
  classify: SafetyClassifier,
  text: string,
  ms: number,
): Promise<SafetyCategory> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("safety check timed out"));
    }, ms);
  });
  const work = Promise.resolve().then(() => classify(text, controller.signal));
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

export async function screenUserMessage(
  text: string,
  classify?: SafetyClassifier,
  { timeoutMs = SAFETY_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<Guard> {
  if (!classify || text.trim() === "") return checkUserMessage(text);
  const reading = readWithinTime(classify, text, timeoutMs).catch(
    () => "NONE" as const,
  );
  const floor = checkUserMessage(text);
  const category = await reading;
  if (category === "NONE") return floor;
  const raised = FROM_MODEL[category];
  return severity(raised) > severity(floor) ? raised : floor;
}
