export type GoogleConfig = { clientId: string; clientSecret: string };

// Google sign-in is optional (D32): both values must be present, otherwise the app
// runs without the provider and the sign-in pages hide the button.
export function readGoogleConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleConfig | undefined {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export function isGoogleSignInEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return readGoogleConfig(env) !== undefined;
}
