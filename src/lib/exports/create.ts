import "server-only";
import { randomUUID } from "node:crypto";
import { attachmentDisposition } from "@/lib/downloads/disposition";
import { prisma } from "@/lib/prisma";
import type { PhotoStorage } from "@/lib/storage/types";
import { loadUnitPrefs } from "@/lib/units/prefs";
import { toCsv, type Cell } from "./csv";
import { EXPORTS_KEPT, EXPORTS_PER_HOUR, MAX_EXPORT_BYTES } from "./limits";
import { loadCoachMessages, loadWorkoutSets } from "./load";
import {
  exportContentType,
  exportFileName,
  exportKey,
  type ExportKind,
} from "./names";
import { coachCsvRows, workoutCsvRows } from "./rows";

export { EXPORTS_KEPT, EXPORTS_PER_HOUR, MAX_EXPORT_BYTES };

const ONE_HOUR_MS = 3_600_000;

export type ExportErrorCode =
  "rate-limited" | "too-large" | "unsupported" | "failed";

export class ExportError extends Error {
  constructor(readonly code: ExportErrorCode) {
    super(code);
    this.name = "ExportError";
  }
}

type Options = { storage: PhotoStorage; now?: Date };

async function csvRowsFor(userId: string, kind: ExportKind): Promise<Cell[][]> {
  if (kind === "WORKOUT_CSV") {
    const [sets, units] = await Promise.all([
      loadWorkoutSets(userId),
      loadUnitPrefs(userId),
    ]);
    return workoutCsvRows(sets, units.weightUnit);
  }
  if (kind === "COACH_CSV")
    return coachCsvRows(await loadCoachMessages(userId));
  throw new ExportError("unsupported");
}

// Past the newest EXPORTS_KEPT, a user's exports are removed: the file first, then the row, so
// a failed delete leaves a row that still points at a file. A failure here never fails the export.
async function removeOldExports(userId: string, storage: PhotoStorage) {
  try {
    const old = await prisma.dataExport.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: EXPORTS_KEPT,
      select: { id: true, r2Key: true },
    });
    await Promise.all(
      old.map(async ({ id, r2Key }) => {
        await storage.delete(r2Key);
        await prisma.dataExport.delete({ where: { id } });
      }),
    );
  } catch (error) {
    console.error("[exports] removing old exports failed", { userId, error });
  }
}

// Builds the file, stores it in R2 and records it in DataExport (D33).
export async function createExport(
  userId: string,
  kind: ExportKind,
  { storage, now = new Date() }: Options,
) {
  const recent = await prisma.dataExport.count({
    where: {
      userId,
      createdAt: { gte: new Date(now.getTime() - ONE_HOUR_MS) },
    },
  });
  if (recent >= EXPORTS_PER_HOUR) throw new ExportError("rate-limited");

  const body = Buffer.from(toCsv(await csvRowsFor(userId, kind)), "utf8");
  if (body.byteLength > MAX_EXPORT_BYTES) throw new ExportError("too-large");

  const r2Key = exportKey(userId, kind, randomUUID());
  await storage.put(r2Key, body, exportContentType(kind), {
    contentDisposition: attachmentDisposition(exportFileName(kind, now)),
  });
  let row: Awaited<ReturnType<typeof prisma.dataExport.create>>;
  try {
    row = await prisma.dataExport.create({
      data: { userId, kind, r2Key, bytes: body.byteLength },
    });
  } catch (error) {
    // Without a row nobody can reach the file, so remove it again.
    await storage.delete(r2Key).catch(() => undefined);
    throw error;
  }
  await removeOldExports(userId, storage);
  return row;
}
