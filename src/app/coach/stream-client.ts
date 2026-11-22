// The browser/server protocol: checked reply pieces, then an explicit save result.
import { z } from "zod";

export const streamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("saved") }),
  z.object({ type: z.literal("unsaved"), message: z.string() }),
]);
export type CoachStreamEvent = z.infer<typeof streamEventSchema>;

// Network chunks need not align with JSON lines or UTF-8 characters. A missing
// terminal event is a dropped connection, never an implied successful save.
export async function readCoachStream(
  response: Response,
  onEvent: (event: CoachStreamEvent) => void,
) {
  if (!response.ok || !response.body) throw new Error("Coach request failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let finished = false;
  const line = (value: string) => {
    if (!value.trim()) return;
    const event = streamEventSchema.parse(JSON.parse(value));
    finished = event.type !== "delta";
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = pending.indexOf("\n")) >= 0) {
        line(pending.slice(0, end));
        pending = pending.slice(end + 1);
        // A committed save stays successful if the connection breaks afterwards.
        if (finished) return;
      }
      if (done) break;
    }
    line(pending);
    if (!finished) throw new Error("Coach stream ended before save result");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
