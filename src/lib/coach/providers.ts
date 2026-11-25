// The two model providers behind the coach's PlanModel (issue #11; the choice is #7).
// Which one leads is one setting, COACH_PROVIDER=groq|gemini; when both keys are set
// the other one is the fallback (D4). Both ask for JSON mode and return the parsed
// object. Keys come from the environment and never appear in an error message.
//
// Three kinds of failure, handled in two places:
//   - transport (429 rate limit, 5xx, network): retried here with backoff, then the
//     other provider is tried (withRetry, withFallback);
//   - content (not JSON, or a plan the verifier rejects): generatePlan retries once
//     with the problems listed, then uses the rule-based plan;
//   - a chat reply with no text: not retried on the same provider; the other one is tried.
// Demo mode (COACH_DEMO_MODE=1, D12 and #59) drops the retry waits and cuts each call
// to DEMO_TIMEOUT_MS, so a failure reaches the fallback without a wait.
// Trade-offs and measurements: docs/COACH_EVAL.md, round 2.
import type { PlanModel } from "./generatePlan";

export type CoachChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CoachChatModel = (messages: CoachChatMessage[]) => Promise<string>;

export const GROQ_MODEL = "openai/gpt-oss-120b";
export const GEMINI_MODEL = "gemini-3.5-flash";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Test-only (D40): the browser tests point Groq calls at a loopback stub. Unset or empty, the address is Groq's.
const groqUrl = () => process.env.COACH_GROQ_URL || GROQ_URL;
const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Long enough for a seven-day plan (Gemini's slowest reply was 15 s), short enough
// that a stalled call moves on in a demo.
const TIMEOUT_MS = 30_000;

// Demo mode (D12, #59): Groq's slowest plan in the 30 October eval took 5.6 s, so 8 s
// lets a working Groq answer and treats a stalled provider as down.
export const DEMO_TIMEOUT_MS = 8_000;

// Per-call settings for the adapters. timeoutMs defaults to TIMEOUT_MS.
export type CallOptions = { timeoutMs?: number };

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
  // the same request fails the same way. A timeout already cost the call limit (30 s,
  // or 8 s in demo mode), so it goes
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
  timeoutMs = TIMEOUT_MS,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
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
  // The limit also covers reading the body; a body that stalls or breaks after the
  // headers is a failed call, so it reaches the other provider like any other.
  try {
    return await res.json();
  } catch (e) {
    const timedOut = (e as Error).name === "TimeoutError";
    // A body that is not JSON (an HTML error page with 200) fails the same way
    // again, so it keeps the status and is not retried; a connection that breaks
    // mid-read is a network drop, retried like any other.
    const notJson = e instanceof SyntaxError;
    throw new ProviderError(
      `${provider} reply ${timedOut ? "timed out" : "could not be read"}`,
      provider,
      notJson ? res.status : undefined,
      undefined,
      timedOut,
    );
  }
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

// Token counts from a response, for the log record (#41). A field is left out when the
// provider did not send it as a count, so the record says null rather than guess.
export type Usage = { inputTokens?: number; outputTokens?: number };
export type UsageReporter = (usage: Usage) => void;

const count = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;

// Groq uses the OpenAI chat-completions format. JSON mode needs the word "JSON" in the
// prompt, which buildPlanPrompt already has. Low reasoning effort: picking from a
// given list needs little planning, and fewer output tokens keep a full-library
// request inside the free tier's tokens-per-minute limit.
export function groqModel(
  apiKey: string,
  model = GROQ_MODEL,
  onUsage?: UsageReporter,
  { timeoutMs }: CallOptions = {},
): PlanModel {
  return async (prompt) => {
    const data = (await postJson(
      "Groq",
      groqUrl(),
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        reasoning_effort: "low",
      },
      timeoutMs,
    )) as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };
    // Before the parse: a reply that is not JSON was still billed and is logged.
    onUsage?.({
      inputTokens: count(data.usage?.prompt_tokens),
      outputTokens: count(data.usage?.completion_tokens),
    });
    return parseReply("Groq", data.choices?.[0]?.message?.content);
  };
}

// Gemini's own REST format. Thinking models can return thought parts first, so take the
// first part that is the answer. Output tokens are the answer's candidatesTokenCount
// plus thoughtsTokenCount: "response pricing is the sum of output tokens and thinking
// tokens" (ai.google.dev/gemini-api/docs/thinking, checked 10 Nov 2026). Either one
// alone still counts; with neither, the output count is unknown.
export function geminiModel(
  apiKey: string,
  model = GEMINI_MODEL,
  onUsage?: UsageReporter,
  { timeoutMs }: CallOptions = {},
): PlanModel {
  return async (prompt) => {
    const data = (await postJson(
      "Gemini",
      geminiUrl(model),
      { "x-goog-api-key": apiKey },
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      },
      timeoutMs,
    )) as {
      candidates?: {
        content?: { parts?: { text?: unknown; thought?: boolean }[] };
        finishReason?: unknown;
      }[];
      usageMetadata?: {
        promptTokenCount?: unknown;
        candidatesTokenCount?: unknown;
        thoughtsTokenCount?: unknown;
      };
    };
    const answerTokens = count(data.usageMetadata?.candidatesTokenCount);
    const thinkingTokens = count(data.usageMetadata?.thoughtsTokenCount);
    onUsage?.({
      inputTokens: count(data.usageMetadata?.promptTokenCount),
      outputTokens:
        answerTokens === undefined && thinkingTokens === undefined
          ? undefined
          : (answerTokens ?? 0) + (thinkingTokens ?? 0),
    });
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parseReply("Gemini", parts.find((p) => !p.thought)?.text);
  };
}

// A chat reply with no text is no answer at all, unlike a plan reply that will not
// parse (generatePlan asks again for that). It is a ProviderError so the chat chain
// moves to the other provider; status 200 makes it non-retryable on this one.
function parseTextReply(
  provider: string,
  text: unknown,
  truncated = false,
): string {
  if (typeof text !== "string" || text.trim() === "") {
    throw new ProviderError(`${provider} reply had no text`, provider, 200);
  }
  return truncated ? `${text.trim()}${TRUNCATION_NOTE}` : text.trim();
}

// A chat reply that stopped at the provider's token limit (Groq finish_reason "length",
// Gemini finishReason "MAX_TOKENS") ends with this note, so the saved text says it is
// incomplete instead of stopping mid-sentence (#137). The cap counts reasoning tokens
// too (Gemini's thinking guide says so; Groq's pages do not say), so it sits well above
// the 4 sentences the prompts ask for. `reasoning_effort` is valid only for the gpt-oss
// models (Groq API reference, checked 22 Nov 2026): a different GROQ_MODEL needs it removed.
export const TRUNCATION_NOTE =
  " (The reply was cut short. Ask again for the rest.)";
const CHAT_MAX_TOKENS = 600;

// The chat request bodies, shared by the plain and the streamed call so both use the
// same settings.
function groqChatBody(model: string, messages: CoachChatMessage[]) {
  return {
    model,
    messages: messages.map(({ role, content }) => ({ role, content })),
    temperature: 0.3,
    max_tokens: CHAT_MAX_TOKENS,
    reasoning_effort: "low",
  };
}

function geminiChatBody(messages: CoachChatMessage[]) {
  const systemInstruction = messages.find(
    (message) => message.role === "system",
  )?.content;
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  return {
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: CHAT_MAX_TOKENS },
  };
}

export function groqChatModel(
  apiKey: string,
  model = GROQ_MODEL,
  { timeoutMs }: CallOptions = {},
): CoachChatModel {
  return async (messages) => {
    const data = (await postJson(
      "Groq",
      groqUrl(),
      { Authorization: `Bearer ${apiKey}` },
      groqChatBody(model, messages),
      timeoutMs,
    )) as {
      choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
    };
    return parseTextReply(
      "Groq",
      data.choices?.[0]?.message?.content,
      data.choices?.[0]?.finish_reason === "length",
    );
  };
}

export function geminiChatModel(
  apiKey: string,
  model = GEMINI_MODEL,
  { timeoutMs }: CallOptions = {},
): CoachChatModel {
  return async (messages) => {
    const data = (await postJson(
      "Gemini",
      geminiUrl(model),
      { "x-goog-api-key": apiKey },
      geminiChatBody(messages),
      timeoutMs,
    )) as {
      candidates?: {
        content?: { parts?: { text?: unknown; thought?: boolean }[] };
        finishReason?: unknown;
      }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    // A reply can arrive in several text parts; Part.thought marks a thought part
    // (Gemini API reference, generateContent, checked 10 Nov 2026). The answer is every
    // other text part, in order.
    const answer = parts
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("");
    return parseTextReply(
      "Gemini",
      answer,
      data.candidates?.[0]?.finishReason === "MAX_TOKENS",
    );
  };
}

export type ProviderEvent = {
  provider: string;
  action: "retry" | "fallback" | "served" | "usage";
  status?: number;
  waitMs?: number;
  model?: string; // on "served": the model that answered
  inputTokens?: number; // on "usage": counts from the response, when it had them
  outputTokens?: number;
};

export type RetryOptions = CallOptions & {
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
export function withRetry(
  model: PlanModel,
  {
    retries = 2,
    baseDelayMs = 1_000,
    maxDelayMs = 8_000,
    sleep = wait,
    onEvent,
  }: RetryOptions = {},
): PlanModel {
  return async (prompt) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await model(prompt);
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

// Tries the second provider when the first fails at the transport level, or when a
// chat reply has no text. A plan reply that isn't valid JSON is not a provider outage,
// so it goes back to generatePlan.
export function withFallback(
  primary: PlanModel,
  fallback: PlanModel,
  onEvent?: (event: ProviderEvent) => void,
): PlanModel {
  return async (prompt) => {
    try {
      return await primary(prompt);
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      onEvent?.({ provider: e.provider, action: "fallback", status: e.status });
      return fallback(prompt);
    }
  };
}

// Reports the provider and model that answered, so a log record can name them (#41).
// A reply that arrived but would not parse also counts as answered: those are the
// records most worth tracing. A ProviderError means no reply, so nothing is reported.
export function servedBy(
  model: PlanModel,
  provider: string,
  modelName: string,
  onEvent?: (event: ProviderEvent) => void,
): PlanModel {
  const served = () =>
    onEvent?.({ provider, action: "served", model: modelName });
  return async (prompt) => {
    try {
      const reply = await model(prompt);
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

// Demo mode is one setting, COACH_DEMO_MODE=1 (or true), turned on for the demo only.
export function isDemoMode(env: Env = process.env): boolean {
  const value = (env.COACH_DEMO_MODE ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

// In demo mode nothing waits for a retry and each call stops at DEMO_TIMEOUT_MS, so a
// rate limit, a server error or a dropped network reaches the other provider, then the
// cache, at once (D12). Options passed in explicitly win over these defaults.
export function retryOptionsFor(
  env: Env = process.env,
  options: RetryOptions = {},
): RetryOptions {
  if (!isDemoMode(env)) return options;
  return {
    ...options,
    retries: options.retries ?? 0,
    timeoutMs: options.timeoutMs ?? DEMO_TIMEOUT_MS,
  };
}

// Builds the coach's model from the environment: the provider named by COACH_PROVIDER
// (Groq by default, D4 in docs/ARCHITECTURE.md) with retries, then the other provider
// with retries when its key is also set.
export function coachModel(
  env: Env = process.env,
  given: RetryOptions = {},
): PlanModel {
  const options = retryOptionsFor(env, given);
  const call = { timeoutMs: options.timeoutMs };
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
    const provider = name === "groq" ? "Groq" : "Gemini";
    // One "usage" event per answered call, so the log record can carry the counts.
    const onUsage: UsageReporter = (usage) => {
      if (usage.inputTokens !== undefined || usage.outputTokens !== undefined)
        options.onEvent?.({ provider, action: "usage", ...usage });
    };
    return servedBy(
      withRetry(
        name === "groq"
          ? groqModel(key, id, onUsage, call)
          : geminiModel(key, id, onUsage, call),
        options,
      ),
      provider,
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

function asPlanModel(model: CoachChatModel): PlanModel {
  return async (serializedMessages) => {
    let messages: CoachChatMessage[];
    try {
      messages = JSON.parse(serializedMessages) as CoachChatMessage[];
    } catch {
      throw new Error("Invalid serialized coach chat messages");
    }
    return { reply: await model(messages) };
  };
}

export function coachChatModel(
  env: Env = process.env,
  given: RetryOptions = {},
): CoachChatModel {
  const options = retryOptionsFor(env, given);
  const call = { timeoutMs: options.timeoutMs };
  const lead = (env.COACH_PROVIDER ?? "groq").trim().toLowerCase();
  if (lead !== "groq" && lead !== "gemini") {
    throw new Error(`COACH_PROVIDER must be groq or gemini, not "${lead}"`);
  }

  const build = (name: "groq" | "gemini", key: string): PlanModel => {
    const modelName =
      name === "groq"
        ? env.GROQ_MODEL || GROQ_MODEL
        : env.GEMINI_MODEL || GEMINI_MODEL;
    const chat =
      name === "groq"
        ? groqChatModel(key, modelName, call)
        : geminiChatModel(key, modelName, call);
    return servedBy(
      withRetry(asPlanModel(chat), options),
      name === "groq" ? "Groq" : "Gemini",
      modelName,
      options.onEvent,
    );
  };

  const other = lead === "groq" ? "gemini" : "groq";
  const keyName = (name: string) => `${name.toUpperCase()}_API_KEY`;
  const primary = build(lead, requireKey(env, keyName(lead)));
  const otherKey = env[keyName(other)];
  const chain = otherKey
    ? withFallback(primary, build(other, otherKey), options.onEvent)
    : primary;

  return async (messages) => {
    const result = await chain(JSON.stringify(messages));
    if (
      !result ||
      typeof result !== "object" ||
      typeof (result as { reply?: unknown }).reply !== "string"
    ) {
      throw new Error("Coach chat returned an invalid response");
    }
    return (result as { reply: string }).reply;
  };
}

// Streamed chat (#11, the real-time feature). A stream yields text pieces as the
// provider sends them. Only a failure before the first piece with text moves to the other
// provider; once text has been shown, switching would start a second, different reply.
// A stream that ends with no text is a ProviderError, as a plain chat reply with no
// text is (parseTextReply), so the other provider is tried.
export type ChatStream = (
  messages: CoachChatMessage[],
) => AsyncIterable<string>;

// Passes pieces through and throws the no-text ProviderError when the stream ends
// without any non-blank text.
async function* requireText(
  provider: string,
  pieces: AsyncIterable<string>,
): AsyncIterable<string> {
  let text = "";
  for await (const piece of pieces) {
    text += piece;
    yield piece;
  }
  if (text.trim() === "") {
    throw new ProviderError(`${provider} reply had no text`, provider, 200);
  }
}

// Reads the data lines of a server-sent event body (#56 review, points 2 and 3).
// - A read that fails after the headers (a dropped connection is a TypeError, a slow
//   body hits the request timeout) becomes a ProviderError, so withStreamFallback can
//   still switch providers while no text has been shown.
// - When the consumer stops early (the reply check trips, or the caller stops reading),
//   the generator's finally cancels the body, which aborts the upstream request, and
//   releases the lock (MDN, ReadableStreamDefaultReader cancel() and releaseLock(),
//   checked 10 Nov 2026). After a normal end the cancel is a no-op.
async function readChunk(
  provider: string,
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  try {
    return await reader.read();
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new ProviderError(
      `${provider} stream ${timedOut ? "timed out" : "broke off"}`,
      provider,
      undefined,
      undefined,
      timedOut,
    );
  }
}

// One data line as JSON. A line that is not JSON, or an error object sent inside the
// stream, is a provider failure like an HTTP error: withStreamFallback can switch while
// nothing has been shown (verifier and silent-failure review, 10 Nov).
function parseEvent(provider: string, data: string): Record<string, unknown> {
  let event: unknown;
  try {
    event = JSON.parse(data);
  } catch {
    throw new ProviderError(`${provider} sent a malformed event`, provider);
  }
  if (typeof event !== "object" || event === null) {
    throw new ProviderError(`${provider} sent a malformed event`, provider);
  }
  const error = (event as { error?: { code?: unknown } }).error;
  if (error) {
    const code = Number(error.code);
    throw new ProviderError(
      `${provider} stream error`,
      provider,
      Number.isInteger(code) ? code : undefined,
    );
  }
  return event as Record<string, unknown>;
}

async function* sseData(
  provider: string,
  res: Response,
): AsyncIterable<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await readChunk(provider, reader);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    // The last event may arrive without a newline after it (Gemini has no [DONE] to mark
    // the end): reading only complete lines dropped its text and its finishReason, so a
    // reply stopped mid-sentence with no note (B3).
    const rest = (buffer + decoder.decode()).trim();
    if (rest.startsWith("data:")) yield rest.slice("data:".length).trim();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function openStream(
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut = (e as Error).name === "TimeoutError";
    throw new ProviderError(
      `${provider} stream ${timedOut ? "timed out" : "failed"}`,
      provider,
      undefined,
      undefined,
      timedOut,
    );
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(
      `${provider} returned HTTP ${res.status}`,
      provider,
      res.status,
      retryAfterMs(res, text),
    );
  }
  return res;
}

export function groqChatStream(
  apiKey: string,
  model = GROQ_MODEL,
  { timeoutMs }: CallOptions = {},
): ChatStream {
  return (messages) =>
    requireText("Groq", groqPieces(apiKey, model, messages, timeoutMs));
}

async function* groqPieces(
  apiKey: string,
  model: string,
  messages: CoachChatMessage[],
  timeoutMs?: number,
): AsyncIterable<string> {
  const res = await openStream(
    "Groq",
    groqUrl(),
    { Authorization: `Bearer ${apiKey}` },
    { ...groqChatBody(model, messages), stream: true },
    timeoutMs,
  );
  let truncated = false;
  let sawText = false;
  for await (const data of sseData("Groq", res)) {
    if (data === "[DONE]") {
      // Only after some text: a note alone would be saved as the whole reply and
      // would stop the other provider being tried.
      if (truncated && sawText) yield TRUNCATION_NOTE;
      return;
    }
    const choice = (
      parseEvent("Groq", data) as {
        choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[];
      }
    ).choices?.[0];
    if (choice?.finish_reason === "length") truncated = true;
    const piece = choice?.delta?.content;
    if (typeof piece === "string" && piece.trim()) sawText = true;
    if (typeof piece === "string" && piece) yield piece;
  }
  // Groq ends every complete stream with data: [DONE] (API reference, checked
  // 10 Nov 2026); a body that closes without it was cut off.
  throw new ProviderError("Groq stream ended before [DONE]", "Groq");
}

export function geminiChatStream(
  apiKey: string,
  model = GEMINI_MODEL,
  { timeoutMs }: CallOptions = {},
): ChatStream {
  return (messages) =>
    requireText("Gemini", geminiPieces(apiKey, model, messages, timeoutMs));
}

async function* geminiPieces(
  apiKey: string,
  model: string,
  messages: CoachChatMessage[],
  timeoutMs?: number,
): AsyncIterable<string> {
  const res = await openStream(
    "Gemini",
    `${geminiUrl(model).replace(":generateContent", ":streamGenerateContent")}?alt=sse`,
    { "x-goog-api-key": apiKey },
    geminiChatBody(messages),
    timeoutMs,
  );
  let truncated = false;
  let sawText = false;
  for await (const data of sseData("Gemini", res)) {
    const candidate = (
      parseEvent("Gemini", data) as {
        candidates?: {
          content?: { parts?: { text?: unknown; thought?: boolean }[] };
          finishReason?: unknown;
        }[];
      }
    ).candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") truncated = true;
    for (const p of candidate?.content?.parts ?? []) {
      if (!p.thought && typeof p.text === "string" && p.text) {
        if (p.text.trim()) sawText = true;
        yield p.text;
      }
    }
  }
  if (truncated && sawText) yield TRUNCATION_NOTE;
}

// Falls back only when the primary fails before sending any text. Whitespace is not
// text (as parseTextReply trims a plain reply), so it does not count as started.
export function withStreamFallback(
  primary: ChatStream,
  fallback: ChatStream,
  onEvent?: (event: ProviderEvent) => void,
): ChatStream {
  return async function* (messages) {
    let started = false;
    try {
      for await (const piece of primary(messages)) {
        if (piece.trim() !== "") started = true;
        yield piece;
      }
    } catch (e) {
      if (started || !(e instanceof ProviderError)) throw e;
      onEvent?.({ provider: e.provider, action: "fallback", status: e.status });
      yield* fallback(messages);
    }
  };
}

// Reports the provider and model when the first piece with text arrives, so the
// turn's record names who answered (#41), as servedBy does for a plain call. A stream
// that fails before any text reports nothing.
export function servedStream(
  stream: ChatStream,
  provider: string,
  modelName: string,
  onEvent?: (event: ProviderEvent) => void,
): ChatStream {
  return async function* (messages) {
    let served = false;
    for await (const piece of stream(messages)) {
      if (!served && piece.trim() !== "") {
        served = true;
        onEvent?.({ provider, action: "served", model: modelName });
      }
      yield piece;
    }
  };
}

export function coachChatStream(
  env: Env = process.env,
  onEvent?: (event: ProviderEvent) => void,
): ChatStream {
  const lead = (env.COACH_PROVIDER ?? "groq").trim().toLowerCase();
  if (lead !== "groq" && lead !== "gemini") {
    throw new Error(`COACH_PROVIDER must be groq or gemini, not "${lead}"`);
  }
  // GROQ_MODEL and GEMINI_MODEL override the defaults, as in coachChatModel. In demo
  // mode each streamed call stops at DEMO_TIMEOUT_MS like the plan and plain chat
  // calls (D12); the limit covers the whole read, as the 30 s one does.
  const { timeoutMs } = retryOptionsFor(env);
  const make = (name: string, key: string) => {
    const modelName =
      name === "groq"
        ? env.GROQ_MODEL || GROQ_MODEL
        : env.GEMINI_MODEL || GEMINI_MODEL;
    return servedStream(
      name === "groq"
        ? groqChatStream(key, modelName, { timeoutMs })
        : geminiChatStream(key, modelName, { timeoutMs }),
      name === "groq" ? "Groq" : "Gemini",
      modelName,
      onEvent,
    );
  };
  const other = lead === "groq" ? "gemini" : "groq";
  const keyName = (name: string) => `${name.toUpperCase()}_API_KEY`;
  const primary = make(lead, requireKey(env, keyName(lead)));
  const otherKey = env[keyName(other)];
  return otherKey
    ? withStreamFallback(primary, make(other, otherKey), onEvent)
    : primary;
}
