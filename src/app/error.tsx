// Root error state: catches errors thrown while rendering any page below src/app and offers a retry.
"use client";

type RouteErrorProps = {
  // Server errors arrive with a generic message in production, so it is never shown to the user.
  error: unknown;
  // Next.js 16.3+: re-fetches and re-renders the segment; reset() would re-render without re-fetching.
  retry: () => void;
};

export default function RouteError({ retry }: RouteErrorProps) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <section className="mx-auto max-w-3xl py-10" data-testid="route-error">
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p
          className="mt-3 max-w-lg text-sm leading-6 text-foreground/70"
          role="alert"
        >
          This page could not load. Try again in a moment.
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
