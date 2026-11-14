import Link from "next/link";
import { AccountTheme, ThemeToggle } from "@/components/auth/account-theme";
import theme from "@/components/progress/progress-theme.module.css";
import ActivityCalendar, {
  type CalendarDay,
} from "@/components/progress/ActivityCalendar";
import DayDetails, { type DayWorkout } from "@/components/progress/DayDetails";
import MuscleMap from "@/components/progress/MuscleMap";
import MuscleStats from "@/components/progress/MuscleStats";
import PhotoStrip from "@/components/progress/PhotoStrip";
import StreakCards from "@/components/progress/StreakCards";
import { UserBadge } from "@/components/photos/UserBadge";
import { requireUser } from "@/lib/auth/session";
import {
  signAvatar,
  signPhotos,
  type GalleryPhoto,
} from "@/lib/photos/gallery";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, dayKey } from "@/lib/progress/dates";
import { loadFinishedWorkouts } from "@/lib/progress/load";
import { regionLabels, slugsFor } from "@/lib/progress/muscleSlugs";
import { muscleShare, musclesWorked } from "@/lib/progress/muscles";
import { activeStreakWeeks, goalMetStreak } from "@/lib/progress/streaks";
import type { ProgressWorkout } from "@/lib/progress/types";
import {
  clock,
  durationMinutes,
  fillPlanGoals,
  groupByDay,
  groupByExercise,
  inMonth,
  monthGrid,
  monthOf,
  pace,
  parseDay,
  parseMonth,
  shiftMonth,
} from "@/lib/progress/view";
import { getPhotoStorage } from "@/lib/storage";

// Streaks and links depend on today's date and expire, so build it on every visit.
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const PHOTOS_SHOWN = 3;

type SearchParams = Promise<{ month?: string; day?: string }>;

function longDay(day: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

function monthName(month: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function toDayWorkout(workout: ProgressWorkout): DayWorkout {
  const run =
    workout.distanceKm !== null && workout.runSeconds !== null
      ? {
          distanceKm: workout.distanceKm,
          time: clock(workout.runSeconds),
          pace: pace(workout.distanceKm, workout.runSeconds),
        }
      : null;
  return {
    id: workout.id,
    name: workout.dayName ?? (run ? "Run" : "Workout"),
    startTime: new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: DEFAULT_TIME_ZONE,
    }).format(workout.startedAt),
    minutes: durationMinutes(workout),
    exercises: groupByExercise(workout.sets),
    run,
  };
}

const workedAnything = (workout: ProgressWorkout) => {
  const { primary, secondary } = musclesWorked(workout.sets);
  return primary.length + secondary.length > 0;
};

// The progress page (#16): a calendar of finished workouts with each day's
// details, the two weekly streaks, a body map of the month's muscles with how
// often each was used, and the newest progress photos.
export default async function ProgressPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const today = dayKey(now);
  const requestedMonth = parseMonth(params.month, monthOf(today));

  // A year of history for the streaks, or more if the month asked for is older.
  const yearAgo = new Date(now.getTime() - 371 * DAY_MS);
  const monthStart = new Date(
    new Date(`${requestedMonth}-01T00:00:00Z`).getTime() - DAY_MS,
  );
  const [loaded, profile, latestPhotos, photoCount] = await Promise.all([
    loadFinishedWorkouts(user.id, monthStart < yearAgo ? monthStart : yearAgo),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { image: true },
    }),
    prisma.progressPhoto.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "desc" },
      take: PHOTOS_SHOWN,
      select: {
        id: true,
        storageKey: true,
        takenAt: true,
        weightKg: true,
        note: true,
      },
    }),
    prisma.progressPhoto.count({ where: { userId: user.id } }),
  ]);
  const workouts = fillPlanGoals(loaded);

  let photos: GalleryPhoto[] | null;
  let avatarUrl: string | null = null;
  try {
    const storage = getPhotoStorage();
    [photos, avatarUrl] = await Promise.all([
      signPhotos(latestPhotos, storage),
      signAvatar(user.id, profile?.image ?? null, storage),
    ]);
  } catch {
    photos = null; // storage not set up or unreachable
  }

  const byDay = groupByDay(workouts);
  const latest = workouts.at(-1);
  const latestDay = latest ? dayKey(latest.startedAt) : undefined;
  // With no month in the link, open on the month of the latest workout.
  const month = params.month
    ? requestedMonth
    : latestDay
      ? monthOf(latestDay)
      : requestedMonth;
  // A day from the link, or else the month's latest workout day, so the details
  // always belong to the month on screen.
  const monthDays = [...byDay.keys()].filter((day) => monthOf(day) === month);
  const linkedDay = parseDay(params.day);
  const selectedDay =
    linkedDay && monthOf(linkedDay) === month ? linkedDay : monthDays.at(-1);

  const hrefFor = (next: { month?: string; day?: string }) => {
    const query = new URLSearchParams();
    query.set("month", next.month ?? month);
    if (next.day) query.set("day", next.day);
    return `/progress?${query.toString()}`;
  };

  const activity: Record<string, CalendarDay> = {};
  for (const [day, list] of byDay) {
    activity[day] = {
      workouts: list.length,
      hasRun: list.some((workout) => workout.distanceKm !== null),
    };
  }

  const streakInput = workouts.map((workout) => ({
    startedAt: workout.startedAt,
    planDays: workout.planDays,
  }));
  const activeWeeks = activeStreakWeeks(streakInput, now).length;
  const goalMetWeeks = goalMetStreak(streakInput, now);

  const dayWorkouts = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const monthWorkouts = inMonth(workouts, month);
  const worked = musclesWorked(
    monthWorkouts.flatMap((workout) => workout.sets),
  );
  const shares = muscleShare(monthWorkouts.map((workout) => workout.sets));
  const strengthWorkouts = monthWorkouts.filter(workedAnything).length;
  const mapLabel = `Muscles worked in ${monthName(month)}`;

  return (
    <AccountTheme
      className={`${theme.progressTheme} min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12`}
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-center justify-between gap-4 border-b border-foreground/15 pb-5">
          <p className="text-sm font-bold tracking-[0.12em]">FORM</p>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4 max-sm:[&_button>span]:hidden">
            <UserBadge name={user.name} imageUrl={avatarUrl} />
            <ThemeToggle />
            <Link
              className="shrink-0 text-xs text-foreground/60 underline underline-offset-4"
              href="/session"
            >
              Today&apos;s session
            </Link>
          </div>
        </header>

        <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
          Your progress
        </p>
        <h1 className="mt-3 mb-8 text-3xl font-semibold sm:text-4xl">
          Consistency is key!
        </h1>

        <div className="grid gap-10">
          {workouts.length === 0 && (
            <p className="m-0 border-l-2 border-foreground px-3 py-2 text-sm">
              No finished workouts yet.{" "}
              <Link className="underline" href="/session">
                Start today&apos;s session
              </Link>{" "}
              and it will show up here.
            </p>
          )}

          <StreakCards activeWeeks={activeWeeks} goalMetWeeks={goalMetWeeks} />

          <div className="grid gap-8 sm:grid-cols-2">
            <ActivityCalendar
              activity={activity}
              hrefFor={hrefFor}
              month={month}
              nextMonth={shiftMonth(month, 1)}
              previousMonth={shiftMonth(month, -1)}
              selectedDay={selectedDay}
              today={today}
              weeks={monthGrid(month)}
            />
            <DayDetails
              dayLabel={selectedDay ? longDay(selectedDay) : null}
              workouts={dayWorkouts.map(toDayWorkout)}
            />
          </div>

          <section aria-labelledby="muscles-title" className="grid gap-5">
            <div>
              <h2 className="m-0 text-lg font-semibold" id="muscles-title">
                Muscles worked
              </h2>
              <p className="mt-1 mb-0 text-xs text-foreground/60">
                {mapLabel}. Runs are not shown on the map.
              </p>
            </div>
            <MuscleMap
              label={mapLabel}
              labels={regionLabels(shares, strengthWorkouts, monthName(month))}
              slugs={slugsFor([...worked.primary, ...worked.secondary])}
            />
            <MuscleStats shares={shares} workouts={strengthWorkouts} />
          </section>

          <PhotoStrip photos={photos} total={photoCount} />
        </div>
      </div>
    </AccountTheme>
  );
}
