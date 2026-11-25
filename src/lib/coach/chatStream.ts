// Streamed coach chat turn (#11, D10): the same checks as coachReply, then the reply a sentence at a time.
// Text is released a sentence at a time, and the reply check runs on everything so far
// before each sentence goes out, so a diagnosis is caught before the user reads it, not
// after. If the check trips, the stream stops and the fixed reply follows; if the
// provider fails, the user sees the fixed unavailable line. Like coachReply, each model
// call writes one coachLog record (#41) with no user text or reply in it. A bug while
// building the prompt throws; once the stream is open, any error (the stream's or the
// reply check's) ends the reply with the unavailable line and is recorded by name.
import {
  UNAVAILABLE_REPLY,
  errorLabel,
  prepareTurn,
  recordChatCall,
  type ChatCallResult,
  type ChatOptions,
  type CoachContext,
} from "./chat";
import { checkCoachReply, type ChatMessage } from "./guardrails";
import type { ChatStream } from "./providers";
import type { SafetyClassifier } from "./safetyScreen";

// The demo fallback (D12, #59): a stored reply for the user's text, and where to hand
// it. Used only when the providers failed before any sentence was shown; the reply is
// handed over, never yielded, so it cannot be shown as the live reply.
export type SavedExample = {
  replyFor: (userText: string) => string | undefined;
  show: (reply: string) => void;
};

export type StreamOptions = ChatOptions & { savedExample?: SavedExample };

// The stored reply to show instead of the unavailable line, if there is one and it
// still passes the reply check.
function savedReply(
  savedExample: SavedExample | undefined,
  userText: string,
): string | undefined {
  const reply = savedExample?.replyFor(userText);
  return reply !== undefined && checkCoachReply(reply).action === "ALLOW"
    ? reply
    : undefined;
}

// The reply check tripped on the text so far; carries the fixed reply to show instead.
class GuardrailStop extends Error {
  constructor(
    readonly action: string,
    readonly reply: string,
  ) {
    super("guardrail");
  }
}

// The end mark and the space after it.
const MARK_AND_SPACE = 2;

// Where the complete sentences in text end, including the space after the last end
// mark, or -1 when no sentence is complete yet. The pattern matches an end mark and a
// space with no end mark after them: in "Keep it. Add a rep. Re" it matches ". " after
// "rep", so 20 is returned ("Keep it. Add a rep. "); "Keep it" and "Keep it." (no space
// yet, the reply may go on) have no match.
function sentencesEnd(text: string): number {
  const cut = text.search(/[.!?]\s(?=[^.!?]*$)/);
  return cut < 0 ? -1 : cut + MARK_AND_SPACE;
}

export async function* coachReplyStream(
  stream: ChatStream,
  ctx: CoachContext,
  history: ChatMessage[],
  userText: string,
  // The model safety check (D15); without it the word list decides alone.
  classify?: SafetyClassifier,
  options: StreamOptions = {},
): AsyncGenerator<string> {
  const turn = await prepareTurn(ctx, history, userText, classify);
  if ("fixed" in turn) {
    yield turn.fixed.reply;
    return;
  }

  const now = options.now ?? Date.now;
  const started = now();
  let recorded = false;
  const record = async (result: ChatCallResult) => {
    recorded = true;
    await recordChatCall(options, now() - started, result);
  };

  // Nothing was shown and the providers failed: hand over the stored reply, if any.
  const showSaved = (): boolean => {
    const saved = savedReply(options.savedExample, userText);
    if (saved === undefined) return false;
    options.savedExample?.show(saved);
    return true;
  };

  let sent = "";
  let pending = "";
  const release = function* (text: string) {
    const checked = checkCoachReply(sent + text);
    if (checked.action !== "ALLOW") {
      throw new GuardrailStop(checked.action, checked.reply);
    }
    sent += text;
    yield text;
  };

  try {
    try {
      for await (const piece of stream(turn.messages)) {
        pending += piece;
        // Whitespace before the first sentence (a provider that sent only a newline
        // before the fallback answered) would show as a blank first line.
        if (!sent) pending = pending.trimStart();
        // Release every complete sentence; keep the unfinished tail.
        const end = sentencesEnd(pending);
        if (end >= 0) {
          yield* release(pending.slice(0, end));
          pending = pending.slice(end);
        }
      }
      if (pending.trim()) yield* release(pending);
    } catch (e) {
      if (e instanceof GuardrailStop) {
        await record({ ok: false, problem: `reply check: ${e.action}` });
        yield (sent ? "\n\n" : "") + e.reply;
        return;
      }
      await record({ error: errorLabel(e) });
      if (sent) {
        yield "\n\n" + UNAVAILABLE_REPLY;
      } else if (!showSaved()) {
        yield UNAVAILABLE_REPLY;
      }
      return;
    }
    // A stream that ends without any text (#56 review, point 4) is a failure the user
    // should see, not a silent empty reply.
    if (!sent.trim()) {
      await record({ error: "stream had no text" });
      if (!showSaved()) yield UNAVAILABLE_REPLY;
      return;
    }
    await record({ ok: true });
  } finally {
    // The reader stopped before the reply ended: the call still gets its one record.
    if (!recorded) await record({ error: "stream stopped by reader" });
  }
}
