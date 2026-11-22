// The two panels of the import page (#131): what a file would add, with a select for each
// exercise name we could not match, and what was saved. Plain markup, no state.
import Link from "next/link";
import type { ImportSummary } from "@/app/import/actions";
import type { ImportResult } from "@/lib/import/save";
import type { LibraryName } from "@/lib/import/match";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export function ImportPreview({
  summary,
  unmatched,
  moreUnmatched = 0,
  library,
}: {
  summary: ImportSummary;
  unmatched: string[];
  moreUnmatched?: number;
  library: LibraryName[];
}) {
  const alreadyImported = summary.workouts - summary.newWorkouts;
  return (
    <section aria-label="Import preview" className="mt-8 grid gap-4">
      <p className="text-sm">
        The file has {plural(summary.workouts, "workout")} and{" "}
        {plural(summary.sets, "set")}, from {summary.firstDay} to{" "}
        {summary.lastDay}. {summary.newWorkouts}{" "}
        {summary.newWorkouts === 1 ? "is" : "are"} new
        {alreadyImported > 0 && `; ${alreadyImported} already imported`}.
      </p>
      <p className="text-xs text-foreground/70">
        {plural(summary.skippedWarmups, "warm-up set")} and{" "}
        {plural(summary.skippedRows, "timed set")} in the file are left out.
        Weights are saved in kg.
      </p>

      {unmatched.length > 0 && (
        <fieldset className="grid gap-3 border border-foreground/15 p-4">
          <legend className="px-1 text-sm font-semibold">
            Exercises we could not match
          </legend>
          <p className="text-xs text-foreground/70">
            Pick the library exercise each one is, or skip it and its sets are
            left out.
          </p>
          {moreUnmatched > 0 && (
            <p className="text-xs text-foreground/70">
              {moreUnmatched} more{" "}
              {moreUnmatched === 1 ? "name is" : "names are"} not shown; their
              sets are skipped.
            </p>
          )}
          {unmatched.map((title, index) => (
            <label key={title} className="grid gap-1 text-sm">
              <span className="font-medium">{title}</span>
              <input type="hidden" name={`title_${index}`} value={title} />
              <select
                name={`map_${index}`}
                defaultValue=""
                className="border border-foreground/30 bg-background px-2 py-2"
              >
                <option value="">Skip these sets</option>
                {library.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}

      <button
        type="submit"
        name="intent"
        value="save"
        disabled={summary.newWorkouts === 0}
        className="w-fit border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
      >
        Import {plural(summary.newWorkouts, "workout")}
      </button>
    </section>
  );
}

export function ImportResultPanel({ result }: { result: ImportResult }) {
  return (
    <section
      aria-label="Import result"
      role="status"
      className="mt-8 grid gap-2"
    >
      <p className="text-sm font-semibold">
        Imported {plural(result.imported, "workout")} with{" "}
        {plural(result.sets, "set")}.
      </p>
      {result.alreadyImported > 0 && (
        <p className="text-sm text-foreground/70">
          {plural(result.alreadyImported, "workout")}{" "}
          {result.alreadyImported === 1 ? "was" : "were"} already imported.
        </p>
      )}
      {result.skippedSets > 0 && (
        <p className="text-sm text-foreground/70">
          {plural(result.skippedSets, "set")} left out because you skipped the
          exercise.
        </p>
      )}
      <Link href="/progress" className="w-fit text-sm underline">
        See them on Progress
      </Link>
    </section>
  );
}
