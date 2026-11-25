import { AuthForm } from "@/components/auth/auth-form";
import { isGoogleSignInEnabled } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // /sign-in?provider=google&error=<code> is where a failed Google return lands (D32).
  const error = firstValue(params.error);
  const fromGoogle = params.provider === "google" && Boolean(error);
  return (
    <AuthForm
      mode="sign-in"
      verified={params.verified === "1" && !params.error}
      verificationError={Boolean(params.error) && !fromGoogle}
      sessionExpired={params.reason === "session-expired"}
      googleEnabled={isGoogleSignInEnabled()}
      googleError={fromGoogle ? error : undefined}
    />
  );
}
