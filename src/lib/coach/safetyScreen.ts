// Layered safety screen for one user message (D15): the model check, the word-list floor and the check-in.
// The model check starts first and reads meaning; the word list (guardrails.ts, with
// the check-in from distress.ts) is the deterministic floor. The model can only raise
// the response, to the check-in, the red-flag reply or the crisis reply; it never
// lowers what the word list finds. If the model is not configured, fails or is slow,
// the word list decides alone, so a provider outage never weakens the floor.
import { REPLIES, checkUserMessage, type Guard } from "./guardrails";

export type SafetyCategory = "CRISIS" | "MEDICAL" | "DISTRESS" | "NONE";
export type SafetyClassifier = (text: string) => Promise<SafetyCategory>;

// Long enough for one short classification on Groq, short enough not to stall a chat
// reply; past it the word list decides.
export const SAFETY_TIMEOUT_MS = 3000;

const FROM_MODEL: Record<Exclude<SafetyCategory, "NONE">, Guard> = {
  CRISIS: { action: "CRISIS", reply: REPLIES.CRISIS },
  MEDICAL: { action: "RED_FLAG", reply: REPLIES.RED_FLAG },
  DISTRESS: { action: "CHECK_IN", reply: REPLIES.CHECK_IN },
};

function severity(guard: Guard): number {
  if (guard.action === "CRISIS") return 3;
  if (guard.action === "RED_FLAG") return 2;
  if (guard.action === "CHECK_IN") return 1;
  return 0;
}

function withinTime<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("safety check timed out")), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

export async function screenUserMessage(
  text: string,
  classify?: SafetyClassifier,
  { timeoutMs = SAFETY_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<Guard> {
  if (!classify || text.trim() === "") return checkUserMessage(text);
  const reading = withinTime(classify(text), timeoutMs).catch(
    () => "NONE" as const,
  );
  const floor = checkUserMessage(text);
  const category = await reading;
  if (category === "NONE") return floor;
  const raised = FROM_MODEL[category];
  return severity(raised) > severity(floor) ? raised : floor;
}
