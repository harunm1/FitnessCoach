import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

// Call at every protected page or mutation, not only in a parent layout.
export async function requireUser() {
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
  if (!session || !session.user.emailVerified) redirect("/sign-in");
  // Expose only account-display fields; password hashes and tokens never reach props.
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };
}
