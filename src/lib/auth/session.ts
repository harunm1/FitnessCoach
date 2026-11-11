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
  // Server-derived identity and tier data; hashes and session tokens stay private.
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    tier: session.user.tier,
    trialEndsAt: session.user.trialEndsAt ?? null,
  };
}
