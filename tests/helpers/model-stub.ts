// Test-only stand-in for Groq's chat endpoint (D40). The browser tests start it on a loopback
// port and point COACH_GROQ_URL at it, so "Personalize with the coach" runs end to end with no
// key and no network. It is a separate process, never an application route.
import { createServer } from "node:http";

export const STUB_PLAN_NAME = "Browser test coach plan";

// The days asked for and the exercise names offered, read from the prompt that
// buildPlanPrompt (src/lib/coach/generatePlan.ts) writes.
export function parsePrompt(prompt: string): { days: number; names: string[] } {
  const days = Number(/Build a (\d+)-day/.exec(prompt)?.[1] ?? 0);
  const listed = /name; name":\n([\s\S]*?)\n\n2 to 8 exercises/.exec(prompt);
  const names = (listed?.[1] ?? "")
    .split("\n")
    .flatMap((line) => line.slice(line.indexOf("): ") + 3).split("; "))
    .filter(Boolean);
  return { days, names };
}

// A plan that passes the verifier: the asked-for number of days, two different
// exercises on each, every name taken from the offered list.
export function planFromPrompt(prompt: string): unknown {
  const { days, names } = parsePrompt(prompt);
  return {
    name: STUB_PLAN_NAME,
    days: Array.from({ length: days }, (_, day) => ({
      name: `Day ${day + 1}`,
      exercises: [0, 1].map((slot) => ({
        exercise: names[(day * 2 + slot) % names.length],
        sets: 3,
        reps: 8,
        restSeconds: 90,
        rpe: 8,
      })),
    })),
  };
}

type Mode = "ok" | "down";
let mode: Mode = "ok";

export function startStub(port: number) {
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/health") {
      response.end('{"ok":true}');
      return;
    }
    if (url.pathname === "/mode" && request.method === "POST") {
      mode = url.searchParams.get("set") === "down" ? "down" : "ok";
      response.end(JSON.stringify({ mode }));
      return;
    }
    if (url.pathname === "/chat/completions" && request.method === "POST") {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        if (mode === "down") {
          response.writeHead(503);
          response.end('{"error":{"message":"stub provider is down"}}');
          return;
        }
        const prompt = JSON.parse(body).messages?.[0]?.content ?? "";
        response.end(
          JSON.stringify({
            choices: [
              { message: { content: JSON.stringify(planFromPrompt(prompt)) } },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 10 },
          }),
        );
      });
      return;
    }
    response.writeHead(404);
    response.end("{}");
  });
  server.listen(port, "127.0.0.1");
  return server;
}

if (process.argv[1]?.endsWith("model-stub.ts")) {
  const server = startStub(Number(process.env.TEST_MODEL_PORT || 18028));
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.on(signal, () => {
      server.close();
      process.exit(0);
    });
}
