// Prisma CLI configuration (ECE1724 Lecture 3 p56). Where the schema is, where the
// migrations go, how the CLI connects, and (Prisma 7) the seed command, which no
// longer lives in package.json.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
