"use client";
// The review of an adapted template (D38). Each change the coach or a rule proposed is
// listed with its reason and can be kept, edited (sets and reps) or reverted; the day
// lists below show the program as it will be saved. Days can move to other weekdays.
// The server checks everything again on save (saveProgram), so this screen is a view,
// not the gate.
import { useState, useTransition } from "react";
import { saveProgram } from "@/app/programs/actions";
import { Button } from "@/components/ui/button";
import type { Adaptation } from "@/lib/programs/adapt";
import { applyChanges, type Change } from "@/lib/programs/changes";
import {
  WEEKDAYS,
  type ProgramTemplate,
  type Weekday,
} from "@/lib/programs/templateSchema";

const WEEKDAY_LABEL: Record<Weekday, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

type Props = {
  template: ProgramTemplate;
  adaptation: Adaptation;
  names: Record<string, string>;
};

type Outcome = { kind: "saved" | "refused"; message: string } | null;

export default function ProgramReview({ template, adaptation, names }: Props) {
  const [changes, setChanges] = useState<Change[]>(adaptation.changes);
  const [accepted, setAccepted] = useState(
    () => new Set(adaptation.changes.map((c) => c.id)),
  );
  const [weekdays, setWeekdays] = useState<Weekday[][]>(() =>
    template.days.map((d) => [...d.weekdays]),
  );
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, startSaving] = useTransition();

  const name = (id: string) => names[id] ?? id.replaceAll("_", " ");
  const { plan } = applyChanges(template, changes, accepted);

  const toggle = (id: string) =>
    setAccepted((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const edit = (id: string, value: number) =>
    setChanges((now) =>
      now.map((c) => {
        if (c.id !== id) return c;
        if (c.op === "sets") return { ...c, sets: value };
        if (c.op === "reps") return { ...c, reps: value };
        return c;
      }),
    );

  const moveDay = (day: number, slot: number, to: Weekday) =>
    setWeekdays((now) =>
      now.map((days, d) =>
        d === day ? days.map((w, i) => (i === slot ? to : w)) : days,
      ),
    );

  const save = () =>
    startSaving(async () => {
      const result = await saveProgram({
        templateId: template.id,
        changes,
        accepted: changes.filter((c) => accepted.has(c.id)).map((c) => c.id),
        weekdays,
      });
      setOutcome(
        result.status === "ok"
          ? {
              kind: "saved",
              message:
                "Program saved. It is now your plan on the Session page.",
            }
          : { kind: "refused", message: result.message },
      );
    });

  const describe = (c: Change): string => {
    const at = template.days[c.day]?.exercises[c.slot];
    const was = at ? name(at.exerciseId) : `slot ${c.slot + 1}`;
    const where = `${template.days[c.day]?.name ?? `Day ${c.day + 1}`}: `;
    if (c.op === "swap") return `${where}${was} → ${name(c.exerciseId)}`;
    if (c.op === "sets") return `${where}${was}, ${at?.sets} → ${c.sets} sets`;
    if (c.op === "reps") return `${where}${was}, ${at?.reps} → ${c.reps} reps`;
    return `${where}remove ${was}`;
  };

  return (
    <div className="space-y-8">
      {adaptation.note ? (
        <p className="rounded-lg border border-current/15 p-3 text-sm">
          {adaptation.note}
        </p>
      ) : null}

      <section aria-labelledby="changes-heading">
        <h2 id="changes-heading" className="text-xl font-semibold">
          Changes to {template.name}
        </h2>
        {changes.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/70">
            No changes: the template fits you as written.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {changes.map((c, i) => (
              <li
                key={c.id}
                className="rounded-lg border border-current/15 p-3"
              >
                <p className="font-medium">{describe(c)}</p>
                <p className="text-sm text-foreground/70">{c.reason}</p>
                <p className="text-xs text-foreground/60">
                  {c.source === "coach"
                    ? "Suggested by the coach"
                    : "Fitted to your equipment"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={accepted.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    Keep this change
                  </label>
                  {c.op === "sets" || c.op === "reps" ? (
                    <label className="flex items-center gap-2">
                      {c.op === "sets" ? "Sets" : "Reps"} for change {i + 1}
                      <input
                        type="number"
                        className="w-16 rounded border border-current/30 bg-transparent px-1"
                        min={1}
                        value={c.op === "sets" ? c.sets : c.reps}
                        onChange={(e) => edit(c.id, Number(e.target.value))}
                      />
                    </label>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {plan.days.map((day, d) => (
        <section
          key={template.days[d].name}
          aria-labelledby={`day-${d}`}
          className="rounded-lg border border-current/15 p-4"
        >
          <h3 id={`day-${d}`} className="font-semibold">
            {day.name}
          </h3>
          {weekdays[d].map((w, i) => (
            <label key={i} className="mt-1 flex items-center gap-2 text-sm">
              {i === 0
                ? `Weekday for ${day.name}`
                : `Weekday ${i + 1} for ${day.name}`}
              <select
                value={w}
                onChange={(e) => moveDay(d, i, e.target.value as Weekday)}
                className="rounded border border-current/30 bg-transparent px-1"
              >
                {WEEKDAYS.map((option) => (
                  <option key={option} value={option}>
                    {WEEKDAY_LABEL[option]}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <ul className="mt-2 list-disc pl-5 text-sm">
            {day.exercises.map((s) => (
              <li key={s.exerciseId}>
                {name(s.exerciseId)}: {s.sets} x {s.reps}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="space-y-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save program"}
        </Button>
        {outcome?.kind === "saved" ? (
          <p role="status">{outcome.message}</p>
        ) : null}
        {outcome?.kind === "refused" ? (
          <p role="alert" className="text-destructive">
            {outcome.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
