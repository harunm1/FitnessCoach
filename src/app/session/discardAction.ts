"use server";
// The Discard workout action (D47): owner-only, unfinished-only. A missing, finished or
// foreign workout all answer 404, so an id says nothing about who owns it.

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { discardOpenWorkout } from "@/lib/workout/discardWorkout";
import { parseWorkoutId, SESSION_LANDING } from "@/lib/workout/sessionPaths";

export async function discardWorkout(workoutId: number) {
  const user = await requireUser();
  const id = parseWorkoutId(String(workoutId));
  if (id === null) notFound();
  if (!(await discardOpenWorkout(prisma, user.id, id))) notFound();
  revalidatePath(SESSION_LANDING);
  redirect(SESSION_LANDING);
}
