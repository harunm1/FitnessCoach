import Link from "next/link";
import QuizForm from "@/components/QuizForm";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10 flex items-center justify-between border-b border-foreground/15 pb-5">
          <Link className="text-sm font-bold tracking-[0.12em]" href="/">
            FORM
          </Link>
          <span className="text-xs text-foreground/60">01 / 01</span>
        </header>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/60">
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
    </main>
  );
}