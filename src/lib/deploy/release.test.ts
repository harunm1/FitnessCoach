// Which database URL the Prisma CLI uses, and which steps a hosted build runs (#57, D19).
import { describe, expect, it } from "vitest";
import {
  buildSteps,
  cliDatabaseUrl,
  databaseTarget,
  hostedDatabaseProblems,
} from "./release";

const POOLED = "postgresql://u:p@ep-x-pooler.neon.tech/db";
const DIRECT = "postgresql://u:p@ep-x.neon.tech/db";
const OTHER_BRANCH = "postgresql://u:p@ep-y.neon.tech/db";
const TEST_DB = "postgresql://u:p@localhost:5432/fitnesscoach_test";

describe("cliDatabaseUrl", () => {
  it("uses the direct connection for migrations on a hosted build", () => {
    expect(
      cliDatabaseUrl({
        VERCEL_ENV: "production",
        DATABASE_URL: POOLED,
        DATABASE_URL_UNPOOLED: DIRECT,
      }),
    ).toBe(DIRECT);
  });

  it("falls back to DATABASE_URL locally, where only one URL is set", () => {
    expect(cliDatabaseUrl({ DATABASE_URL: POOLED })).toBe(POOLED);
  });

  it("treats an empty direct URL as unset", () => {
    expect(
      cliDatabaseUrl({
        VERCEL_ENV: "preview",
        DATABASE_URL: POOLED,
        DATABASE_URL_UNPOOLED: "",
      }),
    ).toBe(POOLED);
  });

  // scripts/migrate-test.ts points the CLI at the test database through DATABASE_URL;
  // a Neon string left in the shell or .env must not redirect it (10 Nov review).
  it("ignores a direct URL outside a hosted build, so test migrations stay on the test database", () => {
    expect(
      cliDatabaseUrl({ DATABASE_URL: TEST_DB, DATABASE_URL_UNPOOLED: DIRECT }),
    ).toBe(TEST_DB);
  });
});

describe("hostedDatabaseProblems", () => {
  it("finds nothing when both URLs reach the same Neon branch", () => {
    expect(
      hostedDatabaseProblems({
        VERCEL_ENV: "preview",
        DATABASE_URL: POOLED,
        DATABASE_URL_UNPOOLED: DIRECT,
      }),
    ).toEqual([]);
  });

  it("checks nothing outside a hosted build", () => {
    expect(hostedDatabaseProblems({})).toEqual([]);
  });

  it("reports a missing direct URL instead of migrating through the pooler", () => {
    expect(
      hostedDatabaseProblems({ VERCEL_ENV: "preview", DATABASE_URL: POOLED }),
    ).toEqual([
      "DATABASE_URL_UNPOOLED is not set for VERCEL_ENV=preview; set the direct Neon string (README, Deploy step 5)",
    ]);
  });

  it("reports a missing app URL, which would fail only at run time", () => {
    expect(
      hostedDatabaseProblems({
        VERCEL_ENV: "production",
        DATABASE_URL_UNPOOLED: DIRECT,
      }),
    ).toEqual([
      "DATABASE_URL is not set for VERCEL_ENV=production; set the pooled Neon string (README, Deploy step 5)",
    ]);
  });

  it("reports URLs that point at different Neon branches, so a preview cannot migrate production", () => {
    expect(
      hostedDatabaseProblems({
        VERCEL_ENV: "preview",
        DATABASE_URL: POOLED,
        DATABASE_URL_UNPOOLED: OTHER_BRANCH,
      }),
    ).toEqual([
      "DATABASE_URL (ep-x-pooler.neon.tech/db) and DATABASE_URL_UNPOOLED (ep-y.neon.tech/db) point at different databases",
    ]);
  });
});

describe("databaseTarget", () => {
  it("names the host and database without the credentials", () => {
    expect(databaseTarget(POOLED)).toBe("ep-x-pooler.neon.tech/db");
    expect(databaseTarget(POOLED)).not.toContain("u:p");
  });

  it("says when a URL cannot be read", () => {
    expect(databaseTarget("not a url")).toBe("an unreadable URL");
  });
});

describe("buildSteps", () => {
  it("migrates before building on a production deployment", () => {
    expect(buildSteps({ VERCEL_ENV: "production" })).toEqual([
      "prisma migrate deploy",
      "next build",
    ]);
  });

  it("migrates before building on a preview deployment", () => {
    expect(buildSteps({ VERCEL_ENV: "preview" })).toEqual([
      "prisma migrate deploy",
      "next build",
    ]);
  });

  it("only builds in local development", () => {
    expect(buildSteps({ VERCEL_ENV: "development" })).toEqual(["next build"]);
  });

  it("only builds when VERCEL_ENV is unset", () => {
    expect(buildSteps({})).toEqual(["next build"]);
  });
});
