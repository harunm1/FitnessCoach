"use client";
// Start a program (D38): pick a template, or build with the coach, which starts from
// the template closest to the user's quiz answers. The coach adapts it on the server
// (adaptProgram); the review then shows each change for the user to keep or revert.
import { useEffect, useRef, useState, useTransition } from "react";
import { adaptProgram, type AdaptResult } from "@/app/programs/actions";
import { Button } from "@/components/ui/button";
import { PROGRAM_TEMPLATES, getTemplate } from "@/lib/programs/templates";
import ProgramReview from "./ProgramReview";

type Opened = Extract<AdaptResult, { status: "ok" }> & { key: number };

const LEVEL_LABEL = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  EXPERT: "Expert",
} as const;

export default function ProgramBuilder({
  closestId,
  quizDays,
  startWithCoach = false,
}: {
  closestId: string | null; // null until the quiz is done
  quizDays?: number;
  startWithCoach?: boolean; // opened from onboarding's "Build with the coach" link
}) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startAdapting] = useTransition();

  const start = (templateId: string) => {
    setError(null);
    setPending(templateId);
    startAdapting(async () => {
      const result = await adaptProgram(templateId);
      setPending(null);
      if (result.status === "ok") setOpened({ ...result, key: Date.now() });
      else setError(result.message);
    });
  };

  // Once per page load, not again on a re-render.
  const started = useRef(false);
  useEffect(() => {
    if (!startWithCoach || !closestId || started.current) return;
    started.current = true;
    start(closestId);
    // start is recreated each render; the ref keeps this to one call.
  }, [startWithCoach, closestId]);

  const template = opened && getTemplate(opened.adaptation.templateId);
  const pendingName = pending && getTemplate(pending)?.name;

  return (
    <div className="space-y-6">
      {closestId ? (
        <div className="rounded-lg border border-current/15 p-4">
          <h3 className="font-semibold">Build with the coach</h3>
          <p className="text-sm text-foreground/70">
            The coach starts from the template closest to your quiz answers (
            {getTemplate(closestId)?.name}) and adapts it to you.
          </p>
          <Button
            className="mt-2"
            onClick={() => start(closestId)}
            disabled={!!pending}
          >
            Build with the coach
          </Button>
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {PROGRAM_TEMPLATES.map((t) => (
          <li key={t.id} className="rounded-lg border border-current/15 p-4">
            <h3 className="font-semibold">{t.name}</h3>
            <p className="text-xs text-foreground/60">
              {t.daysPerWeek} days a week · {LEVEL_LABEL[t.level]} · deload
              every {t.deloadEveryWeeks} weeks
            </p>
            <p className="mt-1 text-sm text-foreground/70">{t.summary}</p>
            <Button
              variant="outline"
              className="mt-2"
              aria-label={`Start from ${t.name}`}
              onClick={() => start(t.id)}
              disabled={!!pending}
            >
              Start from this template
            </Button>
          </li>
        ))}
      </ul>

      {pendingName ? (
        <p role="status">The coach is adapting {pendingName} to you...</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {opened && template ? (
        <ProgramReview
          key={opened.key}
          template={template}
          adaptation={opened.adaptation}
          names={opened.names}
          quizDays={quizDays}
        />
      ) : null}
    </div>
  );
}
