// One Prisma Client for the whole app (ECE1724 Lecture 3 p67: instantiate once, export it).
// Next.js dev mode re-runs modules on hot reload, which would open a new connection pool
// each time; keeping the instance on globalThis in development avoids that. In production
// the module is evaluated once, so the global is not needed.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; copy .env.example to .env");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
