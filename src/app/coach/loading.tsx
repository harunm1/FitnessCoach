// Loading state for /coach (D16, #72's convention): shown while the conversation loads.
export default function CoachLoading() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <p className="mx-auto max-w-2xl text-sm text-foreground/70" role="status">
        Loading your conversation...
      </p>
    </main>
  );
}
