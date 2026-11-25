// Kept apart from google.ts, which reads server environment variables, so the client form can import it.
// The OAuth callback sends failures to /sign-in?provider=google&error=<code>.
export function googleErrorMessage(code: string | undefined) {
  if (code === "account_not_linked")
    return "An account with this email already exists but its email is not verified yet. Sign in with your email and password, or use Resend verification email, verify it, then try Google again.";
  if (code === "email_not_verified")
    return "Google reports this email address as unverified, so we cannot sign you in with it.";
  return "Google sign-in did not complete. Please try again, or use your email and password.";
}
