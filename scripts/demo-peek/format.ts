// Turns a peek result into the text the presenter reads on screen (#162). Times are
// Toronto time with seconds and the zone, so a row added a moment ago stands out on a
// re-run and the repeated hour in November stays unambiguous.
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
  timeZoneName: "short",
});

function stamp(date: Date): string {
  const parts = Object.fromEntries(
    toronto.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}`;
}

function section(title: string, lines: string[]): string[] {
  return [title, ...(lines.length > 0 ? lines : ["  (none yet)"]), ""];
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export function formatPeek(
  result: PeekResult | typeof NO_SUCH_USER,
  databaseName = "(not given)",
): string {
  if (result === NO_SUCH_USER) {
    return "No account has that email. Check the address and the DATABASE_URL.";
  }
  const { user, totals } = result;
  return [
    `${user.name} (${user.tier})  [read-only, SELECT only]`,
    `Database: ${databaseName}   Times: America/Toronto`,
    `${plural(totals.workouts, "workout")}, ${plural(totals.sets, "set")}, ${plural(totals.photos, "photo")}`,
    "",
    ...section(
      "Latest sets (SetLog, newest first; first logged: editing a set keeps its time)",
      result.sets.map(
        (set) =>
          `  #${set.id}  ${stamp(set.loggedAt)}  ${set.exercise}  set ${set.setNumber}  ${set.reps} reps  ${set.weightKg === null ? "bodyweight" : `${set.weightKg} kg`}`,
      ),
    ),
    ...section(
      "Latest workouts (Workout)",
      result.workouts.map(
        (workout) =>
          `  #${workout.id}  ${stamp(workout.startedAt)}  ${workout.finished ? "finished" : "open"}  ${plural(workout.sets, "set")}  source ${workout.source}`,
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
