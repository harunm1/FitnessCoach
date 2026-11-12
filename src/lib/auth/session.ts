import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

// Routes need a signed-out result instead of a page redirect.
export async function getVerifiedUser() {
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
  if (!session || !session.user.emailVerified) return null;
  // Server-derived identity and tier data; hashes and session tokens stay private.
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    tier: session.user.tier,
    trialEndsAt: session.user.trialEndsAt ?? null,
  };
}

// Call at every protected page or mutation, not only in a parent layout.
export async function requireUser() {
  const user = await getVerifiedUser();
  if (!user) redirect("/sign-in");
  return user;
}
