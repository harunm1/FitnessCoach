import type { RecentRun } from "@/lib/progress/loadRuns";
import { MAX_EFFORT } from "@/lib/progress/runLimits";
import { dayLabel } from "@/lib/progress/weightChart";
import {
  formatDistance,
  formatPace,
  type DistanceUnit,
} from "@/lib/units/convert";
import RunForm from "./RunForm";

type RunLogSectionProps = {
  runs: RecentRun[]; // newest first
  today: string; // the user's day, "2026-11-24"
  distanceUnit?: DistanceUnit; // what the user chose (D30); distances are stored in km
};

function details(run: RecentRun, unit: DistanceUnit) {
  return [
    run.time,
    formatPace(run.distanceKm, run.durationSec, unit),
    run.effort === null ? null : `effort ${run.effort}/${MAX_EFFORT}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Logging a run by hand on the Progress page (D27): the form and the latest
// runs as text, each with its pace.
export default function RunLogSection({
  runs,
  today,
  distanceUnit = "KM",
}: RunLogSectionProps) {
  return (
    <section
      aria-labelledby="run-log-title"
      className="grid gap-4 border-t border-foreground/15 pt-6"
    >
      <div>
        <h2 className="m-0 text-lg font-semibold" id="run-log-title">
          Log a run
        </h2>
        <p className="mt-1 mb-0 text-xs text-foreground/60">
          For a run you did without the session screen. If your plan&apos;s next
          day is a run, this run completes it.
        </p>
      </div>
      <RunForm today={today} distanceUnit={distanceUnit} />
      {runs.length === 0 ? (
        <p className="m-0 text-sm text-foreground/70">No runs logged yet.</p>
      ) : (
        <div className="grid gap-2">
          <h3 className="m-0 text-sm font-semibold">Latest runs</h3>
          <ol className="m-0 grid gap-2 p-0 text-sm">
            {runs.map((run) => (
              <li className="list-none" key={run.id}>
                <span className="font-medium">
                  {formatDistance(run.distanceKm, distanceUnit)}
                </span>{" "}
                <span className="text-foreground/60">
                  {dayLabel(run.day)}
                  {run.planDayName && ` · ${run.planDayName}`}
                </span>
                <span className="block text-xs text-foreground/70">
                  {details(run, distanceUnit)}
                </span>
                {run.note && (
                  <span className="block text-xs text-foreground/60">
                    {run.note}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
