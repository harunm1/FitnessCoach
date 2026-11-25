import { dayLabel, weightSummary } from "@/lib/progress/weightChart";
import type { WeightEntry } from "@/lib/progress/weight";
import WeightChart from "./WeightChart";
import WeightForm from "./WeightForm";

type BodyWeightSectionProps = {
  entries: WeightEntry[]; // oldest first
  today: string; // the user's day, "2026-11-24"
};

const RECENT_SHOWN = 5;

function change(kg: number, since: string) {
  if (kg === 0) return `the same as on ${dayLabel(since)}`;
  return `${Math.abs(kg)} kg ${kg < 0 ? "less" : "more"} than on ${dayLabel(since)}`;
}

// The body weight log on the Progress page (D24, #16): a form, a summary in
// words, a line chart and the latest weigh-ins as text.
export default function BodyWeightSection({
  entries,
  today,
}: BodyWeightSectionProps) {
  const summary = weightSummary(entries);
  const recent = entries.slice(-RECENT_SHOWN).reverse();
  return (
    <section
      aria-labelledby="weight-title"
      className="grid gap-4 border-t border-foreground/15 pt-6"
    >
      <div>
        <h2 className="m-0 text-lg font-semibold" id="weight-title">
          Body weight
        </h2>
        <p className="mt-1 mb-0 text-xs text-foreground/60">
          {summary
            ? `Latest: ${summary.latest.weightKg} kg on ${dayLabel(summary.latest.date)}` +
              (entries.length > 1
                ? `, ${change(summary.changeKg, summary.first.date)}.`
                : ".")
            : "No weigh-ins yet. Log one below to start the chart."}
        </p>
      </div>
      <WeightForm today={today} />
      {entries.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
          <WeightChart entries={entries} />
          <ol className="m-0 grid content-start gap-2 p-0 text-sm">
            {recent.map((entry) => (
              <li className="list-none" key={entry.date}>
                <span className="font-medium">{entry.weightKg} kg</span>{" "}
                <span className="text-foreground/60">
                  {dayLabel(entry.date)}
                </span>
                {entry.note && (
                  <span className="block text-xs text-foreground/60">
                    {entry.note}
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
