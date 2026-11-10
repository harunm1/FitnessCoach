"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { activateTrial } from "@/lib/auth/trial";

export type TrialState = {
  status: "idle" | "started" | "unavailable" | "error";
};

export async function startTrial(): Promise<TrialState> {
  const user = await requireUser();
  try {
    const { prisma } = await import("@/lib/prisma");
    const started = await activateTrial(prisma, user.id);
    revalidatePath("/account");
    return { status: started ? "started" : "unavailable" };
  } catch {
    return { status: "error" };
  }
}
