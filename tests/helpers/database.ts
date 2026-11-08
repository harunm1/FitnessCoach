import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

import { testDatabaseURL } from "./database-url";

export function testDatabase() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseURL() }),
  });
}
