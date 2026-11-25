// The two panels of the import page (#131): what a file would add, with a select for each
// exercise name we could not match, and what was saved. The result panel keeps one ref to take focus.
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ImportSummary } from "@/app/import/actions";
import type { ImportReport } from "@/lib/import/report";
import type { ImportResult } from "@/lib/import/save";
import type { LibraryName } from "@/lib/import/match";
import type { WeightUnit } from "@/lib/units/convert";

const UNIT_NAMES = { KG: "kilograms (kg)", LB: "pounds (lb)" };

const plural = (count: number, word: string) =>
  `${count.toLocaleString("en-CA")} ${word}${count === 1 ? "" : "s"}`;

export function ImportPreview({
  summary,
  unmatched,
  moreUnmatched = 0,
  library,
  weightUnit = "KG",
}: {
  summary: ImportSummary;
  unmatched: string[];
  moreUnmatched?: number;
  library: LibraryName[];
  weightUnit?: WeightUnit; // what the user chose (D29)
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
        Weights are shown in {UNIT_NAMES[weightUnit]}, as set on your account
        page.
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

// After Import the page used to look as if it had reset, because the long preview collapsed
// and a short note appeared below the fold. The panel now takes focus and scrolls into view,
// and says what was left out and why (live feedback 24 Nov, item 8).
export function ImportResultPanel({
  result,
  report,
}: {
  result: ImportResult;
  report: ImportReport;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    element.focus();
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "start" });
    }
  }, []);

  const hasLeftOut =
    report.skippedTimedSets > 0 ||
    report.skippedWarmups > 0 ||
    result.skippedSets > 0;
  return (
    <section
      aria-label="Import result"
      className="mt-8 grid scroll-mt-6 gap-2 border-l-2 border-emerald-700 pl-4 outline-none"
      ref={panel}
      role="status"
      tabIndex={-1}
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
      {hasLeftOut && (
        <div className="grid gap-1 text-sm text-foreground/70">
          <p className="m-0 font-medium text-foreground">
            Left out of the import
          </p>
          <ul className="m-0 grid gap-1 pl-5">
            {report.skippedTimedSets > 0 && (
              <li>
                {plural(report.skippedTimedSets, "timed set")}: they have a time
                and no reps, and FitnessCoach stores reps.
              </li>
            )}
            {report.skippedWarmups > 0 && (
              <li>
                {plural(report.skippedWarmups, "warm-up set")}: warm-ups are not
                imported.
              </li>
            )}
            {result.skippedSets > 0 && (
              <li>
                {plural(result.skippedSets, "set")} from exercises with no
                library match
                {report.skippedNames.length > 0 &&
                  `: ${report.skippedNames.join(", ")}`}
                {report.moreSkippedNames > 0 &&
                  ` and ${report.moreSkippedNames} more`}
                .
              </li>
            )}
          </ul>
        </div>
      )}
      <Link href="/progress" className="w-fit text-sm underline">
        See them on Progress
      </Link>
    </section>
  );
}
