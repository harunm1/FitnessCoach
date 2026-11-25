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

// The OAuth callback sends failures to /sign-in?provider=google&error=<code>.
export function googleErrorMessage(code: string | undefined) {
  if (code === "account_not_linked")
    return "An account with this email already exists but its email is not verified yet. Verify it from the email we sent, then try Google again.";
  if (code === "email_not_verified")
    return "Google reports this email address as unverified, so we cannot sign you in with it.";
  return "Google sign-in did not complete. Please try again, or use your email and password.";
}
