import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTier } from "@/lib/auth/access";
import { COACH_TIERS } from "@/lib/auth/tier";
import { coachReplyStream } from "@/lib/coach/chatStream";
import { UNAVAILABLE_REPLY } from "@/lib/coach/chat";
import { providerEventCollector } from "@/lib/coach/coachLog";
import { prismaCoachSink } from "@/lib/coach/coachSink";
import { saveExchange } from "@/lib/coach/conversation";
import { coachChatStream, type ChatStream } from "@/lib/coach/providers";
import { groqSafetyClassifier } from "@/lib/coach/safetyModel";
import { prisma } from "@/lib/prisma";
import { SAVE_FAILED_MESSAGE, TIER_MESSAGE } from "@/app/coach/copy";
import { errorCode, prepareCoachRequest } from "@/app/coach/request";
import type { CoachStreamEvent } from "@/app/coach/stream-client";

export const runtime = "nodejs";
const inputSchema = z.object({ message: z.string() }).strict();
const MAX_BODY_BYTES = 64_000;
const jsonHeaders = { "Cache-Control": "no-store" };

// Bound the bytes read even when Content-Length is absent or forged.
async function readInput(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) return null;
      parts.push(value);
    }
    return inputSchema.parse(JSON.parse(Buffer.concat(parts).toString("utf8")));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  // Cookie-authenticated mutation: require a same-origin browser request. Strict
  // JSON prevents cross-origin HTML forms from spending model quota.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json(
      { message: "Request origin is not allowed." },
      { status: 403, headers: jsonHeaders },
    );
  }
  try {
    const account = await requireTier(COACH_TIERS);
    if (!account.ok) {
      return Response.json(
        {
          code: account.code,
          message: account.status === 403 ? TIER_MESSAGE : account.message,
        },
        { status: account.status, headers: jsonHeaders },
      );
    }
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    ) {
      return Response.json(
        { message: "Send a JSON message." },
        { status: 415, headers: jsonHeaders },
      );
    }
    let input;
    try {
      input = await readInput(request);
    } catch {
      return Response.json(
        { message: "Send a valid message." },
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!input)
      return Response.json(
        { message: "Message body is too large." },
        { status: 413, headers: jsonHeaders },
      );
    const text = input.message.trim();
    const userId = account.user.id;
    const admission = await prepareCoachRequest(userId, text);
    if (!admission.ok) {
      return Response.json(admission.state, {
        status: admission.status,
        headers: jsonHeaders,
      });
    }
    const { context, conversation } = admission;
    const history = (conversation?.messages ?? []).map((message) => ({
      role:
        message.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: message.content,
    }));
    const events = providerEventCollector();
    const sink = prismaCoachSink(userId);
    let unavailable = false;
    // Lazy factory: fixed guardrail replies still work without provider settings.
    const model: ChatStream = async function* (messages) {
      yield* coachChatStream(process.env, events.onEvent)(messages);
    };
    const key = process.env.GROQ_API_KEY;
    const iterator = coachReplyStream(
      model,
      context,
      history,
      text,
      key ? groqSafetyClassifier(key) : undefined,
      {
        takeProviderEvents: events.take,
        log: async (record) => {
          if (record.outcome === "error") unavailable = true;
          await sink(record);
        },
      },
    );
    let cancelled = false;
    let reply = "";
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          const send = (event: CoachStreamEvent) =>
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          try {
            if (request.signal.aborted) {
              await iterator.return(undefined);
              controller.close();
              return;
            }
            const next = await iterator.next();
            if (cancelled) return;
            if (request.signal.aborted) {
              await iterator.return(undefined);
              controller.close();
              return;
            }
            if (!next.done) {
              reply += next.value;
              send({ type: "delta", text: next.value });
              return;
            }
            if (unavailable) {
              send({ type: "unsaved", message: UNAVAILABLE_REPLY });
            } else {
              try {
                await saveExchange(
                  prisma,
                  userId,
                  conversation?.id ?? null,
                  text,
                  reply,
                );
              } catch (error) {
                console.error(
                  "coach: streamed exchange not saved",
                  errorCode(error),
                );
                if (cancelled) return;
                send({ type: "unsaved", message: SAVE_FAILED_MESSAGE });
                controller.close();
                return;
              }
              if (cancelled) return;
              revalidatePath("/coach");
              send({ type: "saved" });
            }
            controller.close();
          } catch (error) {
            console.error("coach: stream failed", errorCode(error));
            await iterator.return(undefined);
            if (!cancelled) {
              send({ type: "unsaved", message: UNAVAILABLE_REPLY });
              controller.close();
            }
          }
        },
        async cancel() {
          cancelled = true;
          await iterator.return(undefined);
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("coach: request unavailable", errorCode(error));
    return Response.json(
      { message: UNAVAILABLE_REPLY },
      { status: 503, headers: jsonHeaders },
    );
  }
}
