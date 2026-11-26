"use server";

// The server action the offline set queue replays through (D31). It answers with a result
// instead of redirecting, so the queue knows whether to drop, keep or retry the set.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import type { SyncOutcome } from "@/lib/offline/types";
import { queuedSetSchema } from "@/lib/workout/queuedSetSchema";
import { recordQueuedSet } from "@/lib/workout/recordQueuedSet";

export async function syncQueuedSet(input: unknown): Promise<SyncOutcome> {
  const user = await requireUser();
  const parsed = queuedSetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "This set has invalid details.",
    };
  }
  const outcome = await recordQueuedSet(user.id, parsed.data);
  if (outcome.status === "saved") revalidatePath("/session", "layout");
  return outcome;
}
