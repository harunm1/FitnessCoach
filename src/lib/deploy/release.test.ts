// Which database URL the Prisma CLI uses, and which steps a hosted build runs (#57, D19).
import { describe, expect, it } from "vitest";
import {
  buildSteps,
  cliDatabaseUrl,
  databaseTarget,
  hostedDatabaseProblems,
  vercelEnvProblem,
} from "./release";

const POOLED = "postgresql://u:p@ep-x-pooler.neon.tech/db";
const DIRECT = "postgresql://u:p@ep-x.neon.tech/db";
const OTHER_BRANCH = "postgresql://u:p@ep-y.neon.tech/db";
const TEST_DB = "postgresql://u:p@localhost:5432/fitnesscoach_test";
const DIRECT_OF_OTHER_POOLED = "postgresql://u:p@ep-x-pooler.neon.tech/db";

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
  // An unreadable URL used to match any other unreadable URL (11 Nov review).
  it("reports each URL that cannot be read instead of treating two as the same database", () => {
    expect(
      hostedDatabaseProblems({
        VERCEL_ENV: "production",
        DATABASE_URL: "not a url",
        DATABASE_URL_UNPOOLED: "also bad",
      }),
    ).toEqual([
      "DATABASE_URL is not a readable URL for VERCEL_ENV=production; copy the pooled Neon string again (README, Deploy step 5)",
      "DATABASE_URL_UNPOOLED is not a readable URL for VERCEL_ENV=production; copy the direct Neon string again (README, Deploy step 5)",
    ]);
  });

  it("reports one unreadable URL even when the other is fine", () => {
    expect(
      hostedDatabaseProblems({
        VERCEL_ENV: "preview",
        DATABASE_URL: POOLED,
        DATABASE_URL_UNPOOLED: "also bad",
      }),
    ).toEqual([
      "DATABASE_URL_UNPOOLED is not a readable URL for VERCEL_ENV=preview; copy the direct Neon string again (README, Deploy step 5)",
    ]);
  });

  // The pooled string pasted twice is one mistake, not two databases (11 Nov review).
  it("says so when the direct URL is the pooled string", () => {
    expect(
      hostedDatabaseProblems({
        VERCEL_ENV: "preview",
        DATABASE_URL: POOLED,
        DATABASE_URL_UNPOOLED: DIRECT_OF_OTHER_POOLED,
      }),
    ).toEqual([
      "DATABASE_URL_UNPOOLED (ep-x-pooler.neon.tech/db) is a pooled string for VERCEL_ENV=preview; set the direct Neon string, with connection pooling off (README, Deploy step 5)",
    ]);
  });
});

describe("vercelEnvProblem", () => {
  // Without System Environment Variables exposed, a Vercel build would skip migrations
  // silently (11 Nov review). VERCEL and VERCEL_ENV are system variables (Vercel docs, 11 Nov 2026).
  it("stops a Vercel build that cannot see VERCEL_ENV", () => {
    expect(vercelEnvProblem({ VERCEL: "1" })).toBe(
      'VERCEL is set but VERCEL_ENV is not production, preview or development; turn on "Enable access to System Environment Variables" in the Vercel project (README, Deploy step 5)',
    );
  });

  it("stops a Vercel build with an unknown VERCEL_ENV", () => {
    expect(vercelEnvProblem({ VERCEL: "1", VERCEL_ENV: "staging" })).toMatch(
      /^VERCEL is set but VERCEL_ENV is not production, preview or development/,
    );
  });

  it.each(["production", "preview", "development"])(
    "accepts a Vercel build with VERCEL_ENV=%s",
    (vercelEnv) => {
      expect(
        vercelEnvProblem({ VERCEL: "1", VERCEL_ENV: vercelEnv }),
      ).toBeUndefined();
    },
  );

  it("checks nothing off Vercel, where VERCEL is unset (local and CI)", () => {
    expect(vercelEnvProblem({})).toBeUndefined();
    expect(vercelEnvProblem({ VERCEL_ENV: "preview" })).toBeUndefined();
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
