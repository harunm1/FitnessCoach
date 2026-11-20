import "server-only";
import { redirect } from "next/navigation";
import type { Tier } from "@/generated/prisma/enums";
import { getVerifiedUser } from "./session";
import { resolveAccess, type Permission } from "./access-policy";

async function getAccount(now?: Date) {
  const user = await getVerifiedUser();
  if (!user) return null;
  const { prisma } = await import("@/lib/prisma");
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      tier: true,
      trialEndsAt: true,
      emailVerified: true,
      billing: { select: { status: true, paidUntil: true } },
    },
  });
  if (!account?.emailVerified) return null;
  return { user, access: resolveAccess(account, now) };
}

export async function requireAccount() {
  const account = await getAccount();
  if (!account) redirect("/sign-in");
  return account;
}

// Expected denials are values: routes return JSON and actions return error states.
// A database outage still throws; callers must stop without starting model work.
export async function requireTier(allowed: readonly Tier[], now?: Date) {
  const account = await getAccount(now);
  if (!account) {
    return {
      ok: false as const,
      status: 401 as const,
      code: "UNAUTHENTICATED" as const,
      message: "Sign in with a verified account to continue.",
    };
  }
  if (!allowed.includes(account.access.effectiveTier)) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "FORBIDDEN" as const,
      message: "Your account does not have access to this feature.",
    };
  }
  return { ok: true as const, ...account };
}

export class AccessDeniedError extends Error {
  constructor() {
    super("Your account does not have access to this feature.");
    this.name = "AccessDeniedError";
  }
}

// Call inside each protected action/handler, before accessing feature data.
// Handlers can map AccessDeniedError to 403; pages can use requirePageAccess.
export async function requirePermission(permission: Permission) {
  const account = await requireAccount();
  if (!account.access.permissions.includes(permission))
    throw new AccessDeniedError();
  return account;
}

export async function requirePageAccess(permission: Permission) {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof AccessDeniedError)
      redirect("/account?access=required");
    throw error;
  }
}
