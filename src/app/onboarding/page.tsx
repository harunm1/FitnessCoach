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
  // experience and equipment raised to what the logged history shows (D34).
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
      </div>
    </AccountTheme>
  );
}
