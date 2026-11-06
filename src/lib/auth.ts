import "server-only";
import { after } from "next/server";
import { readAuthConfig } from "./auth/config";
import { createAuth } from "./auth/core";
import { createEmailSender } from "./auth/email";

let instance: Promise<ReturnType<typeof createAuth>> | undefined;

// No database connection or secret is required while Next.js collects build routes.
export function getAuth() {
  if (!instance) {
    instance = (async () => {
      const config = readAuthConfig();
      const { prisma } = await import("./prisma");
      return createAuth(prisma, config, createEmailSender(), (task) =>
        after(() => task),
      );
    })().catch((error: unknown) => {
      instance = undefined;
      throw error;
    });
  }
  return instance;
}
