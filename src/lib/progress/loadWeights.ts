import "server-only";
import { prisma } from "@/lib/prisma";
import type { WeightEntry } from "./weight";

// A year of daily weigh-ins, with room to spare; the chart never needs more.
export const WEIGHT_HISTORY_LIMIT = 400;

// This user's weigh-ins from `since` ("2025-11-24") on, oldest first, as day
// strings and plain numbers for the chart (D24).
export async function loadBodyWeights(
  userId: string,
  since: string,
): Promise<WeightEntry[]> {
  const rows = await prisma.bodyWeight.findMany({
    where: { userId, date: { gte: new Date(`${since}T00:00:00Z`) } },
    orderBy: { date: "asc" },
    take: WEIGHT_HISTORY_LIMIT,
    select: { date: true, weightKg: true, note: true },
  });
  return rows.map((row) => ({
    // A date column comes back as midnight UTC, so the first ten characters are the day.
    date: row.date.toISOString().slice(0, "YYYY-MM-DD".length),
    weightKg: Number(row.weightKg.toString()),
    note: row.note,
  }));
}
