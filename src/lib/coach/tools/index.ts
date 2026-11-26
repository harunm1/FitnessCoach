// The coach's tools (D43), run by the server on every turn for the signed-in user only. Each
// reads rows where userId is that user; the id comes from the session, never from a message.
// The order is the order the prompt lists them in.
import type { PrismaClient } from "@/generated/prisma/client";
import { loadTrainingProfile } from "@/lib/trainingProfile/load";
import type { WeightUnit } from "@/lib/units/convert";
import { getBodyWeightTrend } from "./bodyWeightTrend";
import { getRecentWorkouts } from "./recentWorkouts";
import { profileResults } from "./trainingProfile";
import type { ToolResult } from "./types";

export type { ToolName, ToolResult } from "./types";

export type ToolsDb = Pick<PrismaClient, "workout" | "setLog" | "bodyWeight">;

export async function runCoachTools(
  db: ToolsDb,
  userId: string,
  unit: WeightUnit,
  now: Date,
): Promise<ToolResult[]> {
  const [profile, recent, weight] = await Promise.all([
    loadTrainingProfile(db, userId, now),
    getRecentWorkouts(db, userId, unit, now),
    getBodyWeightTrend(db, userId, unit, now),
  ]);
  const [training, lifts] = profileResults(profile, unit, now);
  return [training, recent, lifts, weight];
}
