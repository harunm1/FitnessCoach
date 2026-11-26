import Link from "next/link";
import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import theme from "@/components/theme/app-theme.module.css";
import QuizForm from "@/components/QuizForm";
import { requireUser } from "@/lib/auth/session";
import { answersFromProfile } from "@/lib/onboarding/answers";
import { loadAvatarUrl } from "@/lib/photos/avatar";
import { prisma } from "@/lib/prisma";
import { prefillFromHistory } from "@/lib/trainingProfile/prefill";
import { loadTrainingProfile } from "@/lib/trainingProfile/load";

export default async function OnboardingPage() {
  const user = await requireUser();
  const avatarUrl = await loadAvatarUrl(user.id);
  // The saved answers, so the form shows them again instead of the defaults (#138), with
  // experience and equipment raised to what the logged history shows (D36).
  const [profile, history] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        goal: true,
        level: true,
        trainingMode: true,
        daysPerWeek: true,
        equipment: true,
        injuries: true,
      },
    }),
    loadTrainingProfile(prisma, user.id, new Date()),
  ]);
  const { answers, note } = prefillFromHistory(
    answersFromProfile(profile),
    history,
  );

  return (
    <AccountTheme
      className={`${theme.appTheme} min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12`}
    >
      <div className="mx-auto max-w-2xl">
        <AppNav
          name={user.name}
          avatarUrl={avatarUrl}
          actions={<span className="text-sm text-foreground/60">01 / 01</span>}
        />

        <div className="mb-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
            Getting started
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
            Your training profile
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-foreground/70">
            Tell us a little about your goals, schedule, and equipment.
          </p>
        </div>

        {note && (
          <p
            className="mb-6 border-l-2 border-foreground px-3 py-2 text-sm"
            role="note"
          >
            {note}
          </p>
        )}

        <QuizForm initial={answers} />

        {/* D38: after the quiz, a program can come from a template or the coach. */}
        <section
          aria-labelledby="pick-program"
          className="mt-10 rounded-lg border border-current/15 p-4"
        >
          <h2 id="pick-program" className="font-semibold">
            Want a structured program?
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            After saving your answers, pick one of the four templates (full
            body, upper and lower, push pull legs, or a muscle-building split),
            or let the coach adapt the closest one to you. You see every change
            with its reason.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <Link href="/programs#start-program" className="underline">
              Start from a template
            </Link>
            <Link href="/programs?start=coach" className="underline">
              Build with the coach
            </Link>
          </div>
        </section>
      </div>
    </AccountTheme>
  );
}
