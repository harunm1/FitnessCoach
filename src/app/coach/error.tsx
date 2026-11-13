// Error state for /coach (D16, #72's convention): no raw error text, and a retry that re-fetches the page.
"use client";

type CoachErrorProps = {
  // Server errors arrive with a generic message in production, so it is never shown.
  error: unknown;
  // Next.js 16.3+: re-fetches and re-renders the segment; reset() would not re-fetch.
  retry: () => void;
};

export default function CoachError({ retry }: CoachErrorProps) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <section className="mx-auto max-w-2xl py-10" data-testid="coach-error">
        <h1 className="text-3xl font-semibold">
          The coach screen did not load
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/70" role="alert">
          Your plan and logging still work. Try the coach again in a moment.
        </p>
        <button
          className="mt-6 min-h-12 bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
          onClick={() => retry()}
          type="button"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
