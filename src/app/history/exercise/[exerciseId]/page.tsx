import { notFound } from "next/navigation";
import { ExerciseHistoryView } from "@/components/history/ExerciseHistoryView";
import { HistoryShell } from "@/components/history/HistoryShell";
import { requireUser } from "@/lib/auth/session";
import { loadExerciseHistory } from "@/lib/history/load";
import { parseExerciseId } from "@/lib/history/params";
import { navAvatar } from "../../avatar";

export const dynamic = "force-dynamic";

type Params = Promise<{ exerciseId: string }>;

// Every set the signed-in user logged of one exercise (D28). An exercise they never
// logged in a finished workout is a 404, whoever else logged it.
export default async function ExercisePage({ params }: { params: Params }) {
  const user = await requireUser();
  const exerciseId = parseExerciseId((await params).exerciseId);
  if (exerciseId === null) notFound();
  const [exercise, avatarUrl] = await Promise.all([
    loadExerciseHistory(user.id, exerciseId),
    navAvatar(user.id),
  ]);
  if (!exercise) notFound();
  return (
    <HistoryShell
      avatarUrl={avatarUrl}
      eyebrow="Exercise history"
      name={user.name}
      title={exercise.name}
    >
      <ExerciseHistoryView exercise={exercise} />
    </HistoryShell>
  );
}
