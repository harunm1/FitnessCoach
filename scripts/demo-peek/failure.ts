// The one line printed when the peek fails (#162). It is shown on a projector, so it
// carries only the error's name and code and a fixed hint: never the message, which
// can hold the host, the user name or the connection string.
export function describeFailure(error: unknown): string {
  const name = error instanceof Error ? error.name : "unknown error";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? ` ${String((error as { code: unknown }).code)}`
      : "";
  return `Peek failed (${name}${code}). Check DATABASE_URL, the network and the email.`;
}
