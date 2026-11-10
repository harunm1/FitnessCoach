// The two model providers behind the coach's PlanModel (issue #11; the choice is #7).
// Which one leads is one setting, COACH_PROVIDER=groq|gemini; when both keys are set
// the other one is the fallback (D4). Both ask for JSON mode and return the parsed
// object. Keys come from the environment and never appear in an error message.
//
// Two kinds of failure, handled in two places:
//   - transport (429 rate limit, 5xx, network): retried here with backoff, then the
//     other provider is tried (withRetry, withFallback);
//   - content (not JSON, or a plan the verifier rejects): generatePlan retries once
//     with the problems listed, then uses the rule-based plan.
// Trade-offs and measurements: docs/COACH_EVAL.md, round 2.
import type { PlanModel } from "./generatePlan";
import type { ChatMessage } from "./guardrails";

// The chat side of the coach: given the conversation, return the reply text.
export type ChatModel = (messages: ChatMessage[]) => Promise<string>;

export const GROQ_MODEL = "openai/gpt-oss-120b";
export const GEMINI_MODEL = "gemini-3.5-flash";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Long enough for a seven-day plan (Gemini's slowest reply was 15 s), short enough
// that a stalled call moves on in a demo.
const TIMEOUT_MS = 30_000;

type Env = Record<string, string | undefined>;

// A failure of the call itself rather than of the reply's content. status is
// undefined for a network error or timeout.
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
    readonly timedOut = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  // Worth trying the same provider again: rate limits, server errors and network
  // drops are transient (Groq and Gemini error docs). 400, 401, 403 and 413 are not:
  // the same request fails the same way. A timeout already cost 30 s, so it goes
  // straight to the fallback instead of waiting again.
  get retryable(): boolean {
    if (this.timedOut) return false;
    if (this.status === undefined) return true;
    return this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

// "54.5s", "7m12s" or "1h2m3.5s" (Groq's x-ratelimit-reset-* headers) to milliseconds.
function durationMs(text: string): number | undefined {
  const m = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/);
  if (!m || !m[0]) return undefined;
  return (
    Number(m[1] ?? 0) * 3_600_000 +
    Number(m[2] ?? 0) * 60_000 +
    Number(m[3] ?? 0) * 1_000
  );
}

// How long the provider says to wait. Retry-After is seconds or an HTTP date
// (RFC 9110); Groq also sends x-ratelimit-reset-tokens on a tokens-per-minute 429,
// and Gemini's 429 body carries RetryInfo.retryDelay such as "17s".
export function retryAfterMs(res: Response, body: string): number | undefined {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  const reset = res.headers.get("x-ratelimit-reset-tokens");
  if (reset) {
    const ms = durationMs(reset);
    if (ms !== undefined) return ms;
  }
  const delay = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return delay ? Number(delay[1]) * 1000 : undefined;
}

async function postJson(
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = (e as Error).name === "TimeoutError";
    throw new ProviderError(
      `${provider} request ${timedOut ? "timed out" : "failed"}`,
      provider,
      undefined,
      undefined,
      timedOut,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(
      `${provider} returned HTTP ${res.status}`,
      provider,
      res.status,
      retryAfterMs(res, text),
    );
  }
  return res.json();
}

function parseReply(provider: string, text: unknown): unknown {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error(`${provider} reply had no text`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${provider} reply was not valid JSON`);
  }
}

// Groq uses the OpenAI chat-completions format. JSON mode needs the word "JSON" in the
// prompt, which buildPlanPrompt already has. Low reasoning effort: picking from a
// given list needs little planning, and fewer output tokens keep a full-library
// request inside the free tier's tokens-per-minute limit.
export function groqModel(apiKey: string, model = GROQ_MODEL): PlanModel {
  return async (prompt) => {
    const data = (await postJson(
      "Groq",
      GROQ_URL,
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        reasoning_effort: "low",
      },
    )) as { choices?: { message?: { content?: unknown } }[] };
    return parseReply("Groq", data.choices?.[0]?.message?.content);
  };
}

// Gemini's own REST format. Thinking models can return thought parts first, so take the
// first part that is the answer.
export function geminiModel(apiKey: string, model = GEMINI_MODEL): PlanModel {
  return async (prompt) => {
    const data = (await postJson(
      "Gemini",
      geminiUrl(model),
      { "x-goog-api-key": apiKey },
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      },
    )) as {
      candidates?: {
        content?: { parts?: { text?: unknown; thought?: boolean }[] };
      }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parseReply("Gemini", parts.find((p) => !p.thought)?.text);
  };
}

function replyText(provider: string, text: unknown): string {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error(`${provider} reply had no text`);
  }
  return text.trim();
}

// Chat replies are plain text, so no JSON mode. The system prompt stays the first
// message (Groq) or the systemInstruction (Gemini); user text is never merged into it.
export function groqChat(apiKey: string, model = GROQ_MODEL): ChatModel {
  return async (messages) => {
    const data = (await postJson(
      "Groq",
      GROQ_URL,
      { Authorization: `Bearer ${apiKey}` },
      { model, messages, reasoning_effort: "low" },
    )) as { choices?: { message?: { content?: unknown } }[] };
    return replyText("Groq", data.choices?.[0]?.message?.content);
  };
}

function answerText(parts: { text?: unknown; thought?: boolean }[]): string {
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
}

export function geminiChat(apiKey: string, model = GEMINI_MODEL): ChatModel {
  return async (messages) => {
    const system = messages.find((m) => m.role === "system");
    const data = (await postJson(
      "Gemini",
      geminiUrl(model),
      { "x-goog-api-key": apiKey },
      {
        ...(system && {
          systemInstruction: { parts: [{ text: system.content }] },
        }),
        contents: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
      },
    )) as {
      candidates?: {
        content?: { parts?: { text?: unknown; thought?: boolean }[] };
      }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    // A reply can arrive in several text parts. Part.thought marks a thought part (Gemini
    // API reference, generateContent, checked 10 Nov 2026); the answer is every other
    // text part, in order.
    return replyText("Gemini", answerText(parts));
  };
}

export type ProviderEvent = {
  provider: string;
  action: "retry" | "fallback" | "served";
  status?: number;
  waitMs?: number;
  model?: string; // on "served": the model that answered
};

export type RetryOptions = {
  retries?: number; // extra tries after the first
  baseDelayMs?: number;
  maxDelayMs?: number; // a longer Retry-After goes to the fallback instead
  sleep?: (ms: number) => Promise<void>;
  onEvent?: (event: ProviderEvent) => void;
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Exponential backoff with jitter (1 s, then 2 s, each 50 to 100%), as Google's
// troubleshooting guide recommends for 429 and 503. A Retry-After from the provider
// wins when it is short; when it is longer than maxDelayMs the error is passed on, so
// the user isn't left waiting while the other provider is free.
export function withRetry<A, R>(
  model: (input: A) => Promise<R>,
  {
    retries = 2,
    baseDelayMs = 1_000,
    maxDelayMs = 8_000,
    sleep = wait,
    onEvent,
  }: RetryOptions = {},
): (input: A) => Promise<R> {
  return async (input) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await model(input);
      } catch (e) {
        if (!(e instanceof ProviderError) || !e.retryable || attempt >= retries)
          throw e;
        const backoff = baseDelayMs * 2 ** attempt * (0.5 + Math.random() / 2);
        const delay = e.retryAfterMs ?? backoff;
        if (delay > maxDelayMs) throw e;
        onEvent?.({
          provider: e.provider,
          action: "retry",
          status: e.status,
          waitMs: Math.round(delay),
        });
        await sleep(delay);
      }
    }
  };
}

// Tries the second provider when the first fails at the transport level. A reply
// that isn't valid JSON is not a provider outage, so it goes back to generatePlan.
export function withFallback<A, R>(
  primary: (input: A) => Promise<R>,
  fallback: (input: A) => Promise<R>,
  onEvent?: (event: ProviderEvent) => void,
): (input: A) => Promise<R> {
  return async (input) => {
    try {
      return await primary(input);
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      onEvent?.({ provider: e.provider, action: "fallback", status: e.status });
      return fallback(input);
    }
  };
}

// Reports the provider and model that answered, so a log record can name them (#41).
// A reply that arrived but would not parse also counts as answered: those are the
// records most worth tracing. A ProviderError means no reply, so nothing is reported.
export function servedBy<A, R>(
  model: (input: A) => Promise<R>,
  provider: string,
  modelName: string,
  onEvent?: (event: ProviderEvent) => void,
): (input: A) => Promise<R> {
  const served = () =>
    onEvent?.({ provider, action: "served", model: modelName });
  return async (input) => {
    try {
      const reply = await model(input);
      served();
      return reply;
    } catch (e) {
      if (!(e instanceof ProviderError)) served();
      throw e;
    }
  };
}

function requireKey(env: Env, name: string): string {
  const key = env[name];
  if (!key) {
    throw new Error(`${name} is not set; copy .env.example to .env and add it`);
  }
  return key;
}

type Makers<M> = {
  groq: (key: string, model?: string) => M;
  gemini: (key: string, model?: string) => M;
};

// The provider named by COACH_PROVIDER (Groq by default, D4 in docs/ARCHITECTURE.md)
// with retries, then the other provider with retries when its key is also set. Used
// for both plans and chat, so the two always follow the same order.
function chain<A, R>(
  env: Env,
  options: RetryOptions,
  makers: Makers<(input: A) => Promise<R>>,
): (input: A) => Promise<R> {
  const lead = (env.COACH_PROVIDER ?? "groq").trim().toLowerCase();
  if (lead !== "groq" && lead !== "gemini") {
    throw new Error(`COACH_PROVIDER must be groq or gemini, not "${lead}"`);
  }
  // GROQ_MODEL and GEMINI_MODEL override the defaults, so a model swap is a setting.
  const build = (name: "groq" | "gemini", key: string) => {
    const id =
      name === "groq"
        ? env.GROQ_MODEL || GROQ_MODEL
        : env.GEMINI_MODEL || GEMINI_MODEL;
    return servedBy(
      withRetry(
        name === "groq" ? makers.groq(key, id) : makers.gemini(key, id),
        options,
      ),
      name === "groq" ? "Groq" : "Gemini",
      id,
      options.onEvent,
    );
  };
  const other = lead === "groq" ? "gemini" : "groq";
  const keyName = (name: string) => `${name.toUpperCase()}_API_KEY`;
  const primary = build(lead, requireKey(env, keyName(lead)));
  const otherKey = env[keyName(other)];
  return otherKey
    ? withFallback(primary, build(other, otherKey), options.onEvent)
    : primary;
}

export function coachModel(
  env: Env = process.env,
  options: RetryOptions = {},
): PlanModel {
  return chain(env, options, { groq: groqModel, gemini: geminiModel });
}

export function coachChatModel(
  env: Env = process.env,
  options: RetryOptions = {},
): ChatModel {
  return chain(env, options, { groq: groqChat, gemini: geminiChat });
}
