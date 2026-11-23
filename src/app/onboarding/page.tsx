import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import theme from "@/components/theme/app-theme.module.css";
import QuizForm from "@/components/QuizForm";
import { requireUser } from "@/lib/auth/session";
import { loadAvatarUrl } from "@/lib/photos/avatar";

export default async function OnboardingPage() {
  const user = await requireUser();
  const avatarUrl = await loadAvatarUrl(user.id);

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

        <QuizForm />
      </div>
    </AccountTheme>
  );
}
