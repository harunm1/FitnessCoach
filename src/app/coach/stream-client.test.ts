import { describe, expect, it, vi } from "vitest";
import { readCoachStream } from "./stream-client";

function response(text: string, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text);
  let at = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (at === bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(at, at + chunkSize));
        at = Math.min(at + chunkSize, bytes.length);
      },
    }),
  );
}
describe("coach stream client", () => {
  it("decodes split JSON lines and multi-byte text before the final save result", async () => {
    const events: unknown[] = [];
    await readCoachStream(
      response('{"type":"delta","text":"Contrôle 💪"}\n{"type":"saved"}\n'),
      (event) => events.push(event),
    );
    expect(events).toEqual([
      { type: "delta", text: "Contrôle 💪" },
      { type: "saved" },
    ]);
  });
  it("accepts an explicit unsaved result without a trailing newline", async () => {
    const events: unknown[] = [];
    await readCoachStream(
      response('{"type":"unsaved","message":"Try again"}'),
      (event) => events.push(event),
    );
    expect(events).toEqual([{ type: "unsaved", message: "Try again" }]);
  });
  it.each([
    '{"type":"delta","text":"Partial"}\n',
    "",
    '{"type":"other"}\n',
    "invalid\n",
  ])("rejects missing or malformed terminal results", async (body) => {
    await expect(readCoachStream(response(body), () => {})).rejects.toThrow();
  });
  it("accepts a save acknowledgement without waiting for the connection to close", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"saved"}\n'));
      },
      cancel,
    });
    const received: unknown[] = [];
    await readCoachStream(new Response(stream), (event) =>
      received.push(event),
    );
    expect(received).toEqual([{ type: "saved" }]);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
