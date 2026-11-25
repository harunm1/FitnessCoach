import { notFound } from "next/navigation";
import { HistoryShell } from "@/components/history/HistoryShell";
import { WorkoutDetailView } from "@/components/history/WorkoutDetailView";
import { requireUser } from "@/lib/auth/session";
import { loadWorkoutDetail } from "@/lib/history/load";
import { parseWorkoutId } from "@/lib/history/params";
import { loadUnitPrefs } from "@/lib/units/prefs";
import { navAvatar } from "../avatar";

export const dynamic = "force-dynamic";

type Params = Promise<{ workoutId: string }>;

// One past workout in full (D29). Only its owner can open it: the lookup filters on
// the signed-in user, so another user's workout, an open one or a junk id is a 404.
export default async function WorkoutPage({ params }: { params: Params }) {
  const user = await requireUser();
  const workoutId = parseWorkoutId((await params).workoutId);
  if (workoutId === null) notFound();
  const [workout, avatarUrl, units] = await Promise.all([
    loadWorkoutDetail(user.id, workoutId),
    navAvatar(user.id),
    loadUnitPrefs(user.id),
  ]);
  if (!workout) notFound();
  return (
    <HistoryShell
      avatarUrl={avatarUrl}
      eyebrow="Past workout"
      name={user.name}
      title={workout.name}
    >
      <WorkoutDetailView workout={workout} units={units} />
    </HistoryShell>
  );
}
