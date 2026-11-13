import type { MuscleShare } from "@/lib/progress/muscles";

type MuscleStatsProps = {
  shares: MuscleShare[];
  workouts: number; // strength workouts counted
};

// How many of the workouts used each muscle, most used first (#16). Runs are not
// counted, so the shares describe strength work.
export default function MuscleStats({ shares, workouts }: MuscleStatsProps) {
  if (shares.length === 0) {
    return (
      <p className="m-0 text-sm text-foreground/60">
        No strength work to show yet.
      </p>
    );
  }
  return (
    <ul className="grid gap-1.5 p-0">
      {shares.map((share) => (
        <li
          className="grid list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm"
          key={share.muscle}
        >
          <span className="capitalize">{share.muscle}</span>
          <span className="text-xs text-foreground/60">
            {share.workouts} of {workouts} · {Math.round(share.share * 100)}%
          </span>
          <span aria-hidden="true" className="col-span-2 h-1 bg-foreground/10">
            <span
              className="block h-1 bg-foreground"
              style={{ width: `${share.share * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
