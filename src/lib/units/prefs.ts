import "server-only";
import { prisma } from "@/lib/prisma";
import { unitsFromRow, type UnitPrefs } from "./convert";

// The units the signed-in user chose (D29).
export async function loadUnitPrefs(userId: string): Promise<UnitPrefs> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { weightUnit: true, distanceUnit: true },
  });
  return unitsFromRow(row);
}
