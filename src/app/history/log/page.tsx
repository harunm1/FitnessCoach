import Link from "next/link";
import { HistoryShell } from "@/components/history/HistoryShell";
import { PastStrengthForm } from "@/components/history/PastStrengthForm";
import RunForm from "@/components/progress/RunForm";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/progress/dates";
import { loadUnitPrefs } from "@/lib/units/prefs";
import { navAvatar } from "../avatar";

// The form's default day is today, so build the page on every visit.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ type?: string | string[] }>;

const TYPES = [
  { value: "strength", label: "Strength" },
  { value: "run", label: "Run" },
] as const;

// Log a past workout (D49, #194): a workout that already happened, entered without Start and
// Finish. Strength is the new form; a run is the existing one from the Progress page (D27).
export default async function LogPastWorkoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { type: typeParam } = await searchParams;
  // A repeated ?type= arrives as an array; the first is read.
  const picked = Array.isArray(typeParam) ? typeParam[0] : typeParam;
  const type = picked === "run" ? "run" : "strength";
  const today = dayKey(new Date());
  const [units, avatarUrl] = await Promise.all([
    loadUnitPrefs(user.id),
    navAvatar(user.id),
  ]);
  const exercises =
    type === "strength"
      ? await prisma.exercise.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <HistoryShell
      avatarUrl={avatarUrl}
      eyebrow="Your history"
      name={user.name}
      title="Log a past workout"
    >
      <p className="mt-0 mb-6 max-w-xl text-sm leading-6 text-foreground/70">
        Trained without opening the app? Add it here, on the day it happened. It
        counts in History, your streaks and Progress like any other workout.
      </p>
      <nav aria-label="Workout type" className="mb-6 flex gap-2">
        {TYPES.map((option) => (
          <Link
            key={option.value}
            href={`/history/log?type=${option.value}`}
            aria-current={option.value === type ? "page" : undefined}
            className={`inline-flex min-h-11 items-center border px-4 text-sm font-semibold ${
              option.value === type
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/30"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>
      {type === "strength" ? (
        <PastStrengthForm
          exercises={exercises}
          today={today}
          weightUnit={units.weightUnit}
        />
      ) : (
        <RunForm today={today} distanceUnit={units.distanceUnit} />
      )}
    </HistoryShell>
  );
}
