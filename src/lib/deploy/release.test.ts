// Which database URL the Prisma CLI uses, and which steps a hosted build runs (#57, D15).
import { describe, expect, it } from "vitest";
import { buildSteps, cliDatabaseUrl } from "./release";

const POOLED = "postgresql://u:p@ep-x-pooler.neon.tech/db";
const DIRECT = "postgresql://u:p@ep-x.neon.tech/db";

describe("cliDatabaseUrl", () => {
  it("prefers the direct connection for migrations", () => {
    expect(
      cliDatabaseUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT }),
    ).toBe(DIRECT);
  });

  it("falls back to DATABASE_URL locally, where only one URL is set", () => {
    expect(cliDatabaseUrl({ DATABASE_URL: POOLED })).toBe(POOLED);
  });

  it("treats an empty direct URL as unset", () => {
    expect(
      cliDatabaseUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: "" }),
    ).toBe(POOLED);
  });
});

describe("buildSteps", () => {
  it("migrates before building on a production deployment", () => {
    expect(buildSteps({ VERCEL_ENV: "production" })).toEqual([
      "prisma migrate deploy",
      "next build",
    ]);
  });

  it("migrates the preview database before building a pull request preview", () => {
    expect(buildSteps({ VERCEL_ENV: "preview" })).toEqual([
      "prisma migrate deploy",
      "next build",
    ]);
  });

  it("only builds in local development", () => {
    expect(buildSteps({ VERCEL_ENV: "development" })).toEqual(["next build"]);
  });

  it("only builds outside Vercel, as in CI", () => {
    expect(buildSteps({})).toEqual(["next build"]);
  });
});
