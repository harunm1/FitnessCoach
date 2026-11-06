import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-semibold">FitnessCoach</p>
      <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
        Build a training routine that fits you.
      </h1>
      <p className="mt-6 max-w-xl text-lg opacity-80">
        Create your account to get started with personalised fitness coaching.
      </p>
      <div className="mt-9 flex flex-wrap gap-4">
        <Link
          href="/sign-up"
          className="rounded-lg bg-foreground px-5 py-3 font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Create account
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-current/25 px-5 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
