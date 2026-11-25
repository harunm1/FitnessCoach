// The user's programs as folders (D38), newest first: each folder holds the program's
// day routines with their weekdays and, for a program built from a template, its deload
// week (same exercises, about half the sets, a lighter load). Native <details>, so the
// folders open and close with no script and work with a keyboard and screen reader.
import { DELOAD_LOAD_PERCENT, halveSets } from "@/lib/programs/deload";
import { getTemplate } from "@/lib/programs/templates";
import type { Weekday } from "@/lib/programs/templateSchema";
import { WEEKDAY_LABEL } from "@/lib/programs/weekdays";

export type FolderDay = {
  name: string;
  weekdays: Weekday[];
  exercises: { name: string; sets: number; reps: number }[];
};

export type FolderPlan = {
  id: number;
  name: string;
  active: boolean;
  templateId: string | null;
  days: FolderDay[];
};

function DayRoutine({ day, deload }: { day: FolderDay; deload?: boolean }) {
  return (
    <li className="rounded-lg border border-current/10 p-3">
      <p className="font-medium">
        {day.name}
        {day.weekdays.length > 0 ? (
          <span className="ml-2 text-sm font-normal text-foreground/60">
            {day.weekdays.map((w) => WEEKDAY_LABEL[w]).join(", ")}
          </span>
        ) : null}
      </p>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {day.exercises.map((e) => (
          <li key={e.name}>
            {e.name}: {deload ? halveSets(e.sets) : e.sets} x {e.reps}
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function ProgramFolders({ plans }: { plans: FolderPlan[] }) {
  if (plans.length === 0) {
    return (
      <p className="text-sm text-foreground/70">
        No programs yet. Start one from a template below.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {plans.map((plan) => {
        const template = plan.templateId ? getTemplate(plan.templateId) : null;
        return (
          <li key={plan.id}>
            <details
              open={plan.active}
              className="rounded-lg border border-current/15 p-4"
            >
              <summary className="cursor-pointer font-semibold">
                {plan.name}
                {plan.active ? (
                  <span className="ml-2 rounded bg-primary/15 px-2 text-xs">
                    Active
                  </span>
                ) : null}
              </summary>
              <ul className="mt-3 space-y-2">
                {plan.days.map((day) => (
                  <DayRoutine key={day.name} day={day} />
                ))}
              </ul>
              {template ? (
                <details className="mt-3 rounded-lg border border-current/10 p-3">
                  <summary className="cursor-pointer">
                    Deload week, every {template.deloadEveryWeeks} weeks
                  </summary>
                  <p className="mt-2 text-sm text-foreground/70">
                    The same exercises with about half the sets, at about{" "}
                    {DELOAD_LOAD_PERCENT}% of your usual weight.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {plan.days.map((day) => (
                      <DayRoutine key={day.name} day={day} deload />
                    ))}
                  </ul>
                </details>
              ) : null}
            </details>
          </li>
        );
      })}
    </ul>
  );
}
