// Sends each chat case (eval/chatCases.ts) through the production chat path once and
// appends one JSON line per case to eval/results/: the model, the reply and the
// violations from eval/chatChecks.ts. Needs keys in .env; never runs in
// CI. One call per case (the 6 that reach the model), no retries, to spend as little free-tier quota as
// possible.
//   npx tsx eval/chatEval.ts groq              Groq only
//   npx tsx eval/chatEval.ts gemini            Gemini only
// Same prompt and request settings as the app; the model safety check is not run.
// GROQ_MODEL must stay a gpt-oss model (the request always sends reasoning_effort);
// GEMINI_MODEL can be any Gemini model. Criteria:
// docs/COACH_EVAL.md, "Chat replies".
import "dotenv/config";
import { appendFileSync, mkdirSync } from "node:fs";
import {
  CHAT_PROMPT_VERSION,
  coachReply,
  type CoachContext,
} from "../src/lib/coach/chat";
import {
  coachChatModel,
  GEMINI_MODEL,
  GROQ_MODEL,
} from "../src/lib/coach/providers";
import { CHAT_CASES } from "./chatCases";
import { checkChatReply } from "./chatChecks";

const PAUSE_MS = Number(process.env.PAUSE_MS ?? 3000);

async function main() {
  const mode = process.argv[2];
  if (mode !== "groq" && mode !== "gemini") {
    throw new Error("usage: npx tsx eval/chatEval.ts groq|gemini");
  }
  const keyName = `${mode.toUpperCase()}_API_KEY`;
  const model = coachChatModel(
    {
      COACH_PROVIDER: mode,
      [keyName]: process.env[keyName],
      GROQ_MODEL: process.env.GROQ_MODEL,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
    },
    { retries: 0 },
  );
  mkdirSync("eval/results", { recursive: true });
  const file = `eval/results/${new Date().toISOString().slice(0, 10)}-${mode}-chat-${CHAT_PROMPT_VERSION}.jsonl`;

  for (const chatCase of CHAT_CASES.filter((c) => c.reachesModel)) {
    const context: CoachContext = chatCase.context;
    const turn = await coachReply(model, context, [], chatCase.message);
    const violations =
      turn.source === "COACH" ? checkChatReply(turn.reply, chatCase) : [];
    const row = {
      id: chatCase.id,
      prompt: CHAT_PROMPT_VERSION,
      model:
        mode === "groq"
          ? process.env.GROQ_MODEL || GROQ_MODEL
          : process.env.GEMINI_MODEL || GEMINI_MODEL,
      source: turn.source,
      reply: turn.reply,
      violations,
    };
    appendFileSync(file, JSON.stringify(row) + "\n");
    console.log(
      `${chatCase.id}: ${turn.source} ${turn.source === "COACH" ? violations.join(",") || "ok" : "skipped"}`,
    );
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
  console.log(`appended to ${file}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
