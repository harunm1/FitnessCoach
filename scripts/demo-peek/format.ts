// Turns a peek result into the text the presenter reads on screen (#162). Times are
// Toronto time with seconds, so a row added a moment ago stands out on a re-run.
import { NO_SUCH_USER, type PeekResult } from "./queries";

const toronto = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function stamp(date: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    toronto.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

function section(title: string, lines: string[]): string[] {
  return [title, ...(lines.length > 0 ? lines : ["  (none yet)"]), ""];
}

export function formatPeek(result: PeekResult | typeof NO_SUCH_USER): string {
  if (result === NO_SUCH_USER) {
    return "No account has that email. Check the address and the DATABASE_URL.";
  }
  const { user, totals } = result;
  return [
    `${user.name} (${user.tier})  [read-only, SELECT only]`,
    `${totals.workouts} workouts, ${totals.sets} sets, ${totals.photos} photos`,
    "",
    ...section(
      "Latest sets (SetLog, newest first)",
      result.sets.map(
        (set) =>
          `  #${set.id}  ${stamp(set.loggedAt)}  ${set.exercise}  set ${set.setNumber}  ${set.reps} reps  ${set.weightKg ?? "bodyweight"}${set.weightKg === null ? "" : " kg"}`,
      ),
    ),
    ...section(
      "Latest workouts (Workout)",
      result.workouts.map(
        (workout) =>
          `  #${workout.id}  ${stamp(workout.startedAt)}  ${workout.finished ? "finished" : "open"}  ${workout.sets} sets  source ${workout.source}`,
      ),
    ),
    ...section(
      "Latest progress photos (ProgressPhoto; the file is in the private R2 bucket under this key)",
      result.photos.map(
        (photo) =>
          `  #${photo.id}  ${stamp(photo.takenAt)}  ${photo.storageKey}`,
      ),
    ),
  ].join("\n");
}
