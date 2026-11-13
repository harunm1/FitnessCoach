import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CoachRecord, CoachSink } from "./coachLog";
import type { Guard } from "./guardrails";

// #98 adds these fields to CoachRecord. Older callers leave them unknown/null.
type RecordMetadata = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  guardrailVerdict?: Guard["action"] | null;
};

function jsonValue(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Coach records must contain JSON-serializable values.");
  }
  const parsed = JSON.parse(serialized) as Prisma.InputJsonValue | null;
  return parsed === null ? Prisma.JsonNull : parsed;
}

// Bind an ID from a verified server session, never from a request body.
// writeRecord handles failures; a logging outage must not break the coach reply.
export function prismaCoachSink(userId: string): CoachSink {
  if (!userId.trim())
    throw new Error("A server user ID is required for coach records.");

  return async (record: CoachRecord) => {
    const metadata: CoachRecord & RecordMetadata = record;
    await prisma.coachEvent.create({
      data: {
        userId,
        kind: record.kind,
        promptVersion: record.promptVersion,
        attempt: record.attempt,
        latencyMs: record.latencyMs,
        outcome: record.outcome,
        provider: record.provider ?? null,
        model: record.model ?? null,
        inputTokens: metadata.inputTokens ?? null,
        outputTokens: metadata.outputTokens ?? null,
        guardrailVerdict: metadata.guardrailVerdict ?? null,
        providerEvents: jsonValue(record.providerEvents),
        problems:
          record.problems === undefined
            ? Prisma.DbNull
            : jsonValue(record.problems),
        raw: record.raw === undefined ? Prisma.DbNull : jsonValue(record.raw),
      },
    });
  };
}
