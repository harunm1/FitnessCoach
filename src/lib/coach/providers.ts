// The two model providers behind the coach's PlanModel (issue #11; the choice is #7).
// Which one runs is one setting, COACH_PROVIDER=groq|gemini, so the head-to-head and a
// switch on demo day need no code change. Both ask for JSON mode and return the parsed
// object. Any HTTP error, timeout or unparseable reply throws, and generatePlan counts
// a throw as a failed attempt (retry once, then the rule-based plan). Keys come from
// the environment and never appear in an error message.
import type { PlanModel } from "./generatePlan";

export const GROQ_MODEL = "openai/gpt-oss-120b";
export const GEMINI_MODEL = "gemini-3.5-flash";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Long enough for a seven-day plan, short enough that a stalled call falls back in a demo.
const TIMEOUT_MS = 30_000;

type Env = Record<string, string | undefined>;

async function postJson(
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${provider} returned HTTP ${res.status}`);
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
// prompt, which buildPlanPrompt already has.
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

function requireKey(env: Env, name: string): string {
  const key = env[name];
  if (!key) {
    throw new Error(`${name} is not set; copy .env.example to .env and add it`);
  }
  return key;
}

// Picks the provider from the environment. Groq is the default (D4, docs/ARCHITECTURE.md).
export function coachModel(env: Env = process.env): PlanModel {
  const provider = (env.COACH_PROVIDER ?? "groq").trim().toLowerCase();
  if (provider === "groq") return groqModel(requireKey(env, "GROQ_API_KEY"));
  if (provider === "gemini") {
    return geminiModel(requireKey(env, "GEMINI_API_KEY"));
  }
  throw new Error(`COACH_PROVIDER must be groq or gemini, not "${provider}"`);
}
