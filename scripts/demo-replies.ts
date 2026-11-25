// Records src/lib/coach/demoReplies.json (#59, D12): npx tsx --env-file=.env scripts/demo-replies.ts.
// Asks the real chat pipeline (prompt, providers, reply check) each quick reply once for
// the sample profile, one model call each, and keeps only replies that passed the check.
import { writeFileSync } from "node:fs";
import { QUICK_REPLIES } from "../src/components/coach/QuickReplies";
import { CHAT_PROMPT_VERSION } from "../src/lib/coach/chat";
import { coachReplyStream } from "../src/lib/coach/chatStream";
import type { CoachRecord } from "../src/lib/coach/coachLog";
import {
  DEMO_CHAT_CONTEXT,
  chatPromptFingerprint,
  type DemoReply,
  type DemoReplyCache,
} from "../src/lib/coach/demoReplies";
import {
  coachChatStream,
  type ProviderEvent,
} from "../src/lib/coach/providers";

const OUT = "src/lib/coach/demoReplies.json";
const JSON_INDENT = 2;
// The Toronto day, the app's zone, as YYYY-MM-DD ("en-CA" formats dates that way).
const torontoDay = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

async function record(question: string): Promise<DemoReply> {
  const events: ProviderEvent[] = [];
  const logs: CoachRecord[] = [];
  const stream = coachChatStream(process.env, (event) => events.push(event));
  const pieces = await Array.fromAsync(
    coachReplyStream(stream, DEMO_CHAT_CONTEXT, [], question, undefined, {
      log: async (entry) => {
        logs.push(entry);
      },
    }),
  );
  const served = events.find((event) => event.action === "served");
  if (logs.at(-1)?.outcome !== "ok" || !served?.model) {
    throw new Error(`No checked live reply for "${question}"; nothing written`);
  }
  return { question, reply: pieces.join("").trim(), model: served.model };
}

async function main() {
  const replies = await Promise.all(QUICK_REPLIES.map(record));
  const cache: DemoReplyCache = {
    promptVersion: CHAT_PROMPT_VERSION,
    promptFingerprint: chatPromptFingerprint(),
    recordedOn: torontoDay(),
    replies,
  };
  writeFileSync(OUT, `${JSON.stringify(cache, null, JSON_INDENT)}\n`);
  console.log(`Wrote ${replies.length} replies to ${OUT}`);
}

void main();
