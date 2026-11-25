import { AuthForm } from "@/components/auth/auth-form";
import { isGoogleSignInEnabled } from "@/lib/auth/google";

// Read per request, so setting the Google variables never needs a rebuild to show the button.
export const dynamic = "force-dynamic";

export default function Page() {
  return <AuthForm mode="sign-up" googleEnabled={isGoogleSignInEnabled()} />;
}
