import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "./session";
import { resolveAccess, type Permission } from "./access-policy";

export async function requireAccount() {
  const user = await requireUser();
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
  if (!account?.emailVerified) redirect("/sign-in");
  return { user, access: resolveAccess(account) };
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
