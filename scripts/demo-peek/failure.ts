// The one line printed when the peek fails (#162). It is shown on a projector, so it
// carries only the error's name and code and a fixed hint: never the message, which
// can hold the host, the user name or the connection string.
// Prisma uses `code` on request errors and `errorCode` on initialization errors.
function codeOf(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const fields = error as { code?: unknown; errorCode?: unknown };
  const code = fields.code ?? fields.errorCode;
  return code === undefined ? "" : ` ${String(code)}`;
}

export function describeFailure(error: unknown): string {
  const name = error instanceof Error ? error.name : "unknown error";
  return `Peek failed (${name}${codeOf(error)}). Check DATABASE_URL, the network and the email.`;
}
