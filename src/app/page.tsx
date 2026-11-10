import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-semibold">FORM</h1>
      <p className="mt-3 text-sm text-foreground/70">
        A fitness coach for a routine that fits your life.
      </p>
      <Link
        className="mt-8 inline-flex min-h-11 items-center justify-center bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-80"
        href="/onboarding"
      >
        Start your quiz
      </Link>
      <div className="mt-4 flex gap-6 text-sm">
        <Link className="underline underline-offset-4" href="/sign-up">
          Create account
        </Link>
        <Link className="underline underline-offset-4" href="/sign-in">
          Sign in
        </Link>
      </div>
    </main>
  );
}
