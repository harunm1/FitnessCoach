// Root loading fallback: Next.js wraps every page below src/app in <Suspense> with this as the fallback.
export default function Loading() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <p className="mx-auto max-w-3xl text-sm text-foreground/70" role="status">
        Loading your plan...
      </p>
    </main>
  );
}
