// Which database URL the Prisma CLI uses, and which steps a hosted build runs (#57, D19).
import { describe, expect, it } from "vitest";
import prismaConfig from "../../../prisma.config";
import {
  buildSteps,
  cliDatabaseUrl,
  SEED_STEP,
  stepEnv,
  databaseTarget,
  hostedDatabaseProblems,
  runSteps,
  testMigrationEnv,
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
  const PROBLEM =
    /^VERCEL_ENV is not production or preview; turn on "Enable access to System Environment Variables"/;

  // VERCEL and VERCEL_ENV are both system variables, so a Vercel project with that
  // setting off shows neither. The build script runs only on Vercel and in CI, which
  // sets VERCEL_ENV, so no VERCEL_ENV always stops it (13 Nov review).
  it("stops a build that can see neither VERCEL nor VERCEL_ENV", () => {
    expect(vercelEnvProblem({})).toMatch(PROBLEM);
  });

  it("stops a Vercel build that cannot see VERCEL_ENV", () => {
    expect(vercelEnvProblem({ VERCEL: "1" })).toMatch(PROBLEM);
  });

  it.each(["staging", "development", ""])(
    "stops a build with VERCEL_ENV=%j, which never migrates",
    (vercelEnv) => {
      expect(vercelEnvProblem({ VERCEL: "1", VERCEL_ENV: vercelEnv })).toMatch(
        PROBLEM,
      );
    },
  );

  it.each(["production", "preview"])(
    "accepts a build with VERCEL_ENV=%s, on Vercel or in CI",
    (vercelEnv) => {
      expect(
        vercelEnvProblem({ VERCEL: "1", VERCEL_ENV: vercelEnv }),
      ).toBeUndefined();
      expect(vercelEnvProblem({ VERCEL_ENV: vercelEnv })).toBeUndefined();
    },
  );
});

describe("testMigrationEnv", () => {
  const shell = {
    PATH: "/usr/bin",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    DATABASE_URL: POOLED,
    DATABASE_URL_UNPOOLED: DIRECT,
  };

  // A preview VERCEL_ENV and a Neon direct URL left in the shell used to send
  // npm run db:migrate:test to Neon (11 Nov review).
  it("points the Prisma CLI at the test database whatever the shell holds", () => {
    expect(cliDatabaseUrl(testMigrationEnv(shell, TEST_DB))).toBe(TEST_DB);
  });

  // Empty, not deleted: dotenv (prisma.config.ts) fills only keys that are absent, so a
  // value in .env cannot come back.
  it("blanks the hosted-build variables instead of deleting them", () => {
    expect(testMigrationEnv(shell, TEST_DB)).toEqual({
      PATH: "/usr/bin",
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: TEST_DB,
      DATABASE_URL_UNPOOLED: "",
    });
  });

  it("leaves the caller's environment unchanged", () => {
    const before = { ...shell };
    testMigrationEnv(shell, TEST_DB);
    expect(shell).toEqual(before);
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

  // An unencoded "/" in a password moves where the URL parser thinks the host starts.
  it("never prints part of a password that holds a slash", () => {
    const target = databaseTarget("postgresql://user:12/34@host.neon.tech/db");
    expect(target).toBe("an unreadable URL");
    expect(target).not.toContain("34");
  });

  // After the slash, a "?" or "#" moves the rest of the password and the real host
  // into the query or the fragment, where a path check would not see them.
  it.each([
    "postgresql://owner:4321/Hidden?Tail@ep-x-pooler.neon.tech/neondb?sslmode=require",
    "postgresql://owner:4321/Hidden#Tail@ep-x.neon.tech/neondb",
    // An "@" before the "/", "?" or "#": the user name parses, the host is still wrong.
    "postgresql://owner:Sec@ret/Pass@ep-x.neon.tech/db",
    "postgresql://owner:Sec@ret?Pass@ep-x.neon.tech/db",
    "postgresql://owner:Sec@ret#Pass@ep-x.neon.tech/db",
  ])("never prints the user or password of %s", (url) => {
    const target = databaseTarget(url);
    expect(target).toBe("an unreadable URL");
  });

  it("stops the build for such a URL instead of comparing user names as hosts", () => {
    const url =
      "postgresql://owner:4321/Hidden?Tail@ep-x.neon.tech/neondb?sslmode=require";
    const problems = hostedDatabaseProblems({
      VERCEL_ENV: "preview",
      DATABASE_URL: url,
      DATABASE_URL_UNPOOLED: url,
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(" ")).not.toContain("owner");
    expect(problems.join(" ")).not.toContain("4321");
  });
});

describe("buildSteps", () => {
  it("migrates, then seeds the exercise library, before building on a production deployment", () => {
    expect(buildSteps({ VERCEL_ENV: "production" })).toEqual([
      "prisma migrate deploy",
      SEED_STEP,
      "next build",
    ]);
  });

  it("migrates, then seeds the exercise library, before building on a preview deployment", () => {
    expect(buildSteps({ VERCEL_ENV: "preview" })).toEqual([
      "prisma migrate deploy",
      SEED_STEP,
      "next build",
    ]);
  });

  it("returns only next build for VERCEL_ENV=development", () => {
    expect(buildSteps({ VERCEL_ENV: "development" })).toEqual(["next build"]);
  });

  it("returns only next build when VERCEL_ENV is unset", () => {
    expect(buildSteps({})).toEqual(["next build"]);
  });
});

describe("SEED_STEP", () => {
  // Prisma 7 runs only the seed configured in prisma.config.ts migrations.seed.
  it("runs the exercise seed that prisma.config.ts names", () => {
    expect(SEED_STEP).toBe("prisma db seed");
    expect(prismaConfig.migrations?.seed).toBe("tsx prisma/seed.ts");
  });
});

describe("runSteps", () => {
  const hosted = {
    VERCEL_ENV: "preview",
    DATABASE_URL: POOLED,
    DATABASE_URL_UNPOOLED: DIRECT,
    DEMO_PASSWORD: "a-local-demo-password",
  };
  const steps = ["prisma migrate deploy", SEED_STEP, "next build"];

  function recorder(failOn?: string, status = 1) {
    const calls: { command: string; env: typeof hosted }[] = [];
    const run = (command: string, env: typeof hosted) => {
      calls.push({ command, env });
      return failOn !== undefined && command.endsWith(failOn) ? status : 0;
    };
    return { calls, run };
  }

  it("runs every step in order through npx --no-install and reports no failure", () => {
    const { calls, run } = recorder();
    expect(runSteps(steps, hosted, run)).toBeUndefined();
    expect(calls.map((c) => c.command)).toEqual([
      "npx --no-install prisma migrate deploy",
      "npx --no-install prisma db seed",
      "npx --no-install next build",
    ]);
  });

  it("hands the seed step a blank DEMO_PASSWORD and the other steps the environment as is", () => {
    const { calls, run } = recorder();
    runSteps(steps, hosted, run);
    expect(calls[1].env.DEMO_PASSWORD).toBe("");
    expect(calls[0].env.DEMO_PASSWORD).toBe("a-local-demo-password");
    expect(calls[2].env.DEMO_PASSWORD).toBe("a-local-demo-password");
  });

  it("stops at the first failing step and names it with its exit status", () => {
    const { calls, run } = recorder(SEED_STEP, 3);
    expect(runSteps(steps, hosted, run)).toEqual({
      step: SEED_STEP,
      status: 3,
    });
    expect(calls).toHaveLength(2);
  });
});

describe("stepEnv", () => {
  const hosted = {
    VERCEL_ENV: "production",
    DATABASE_URL: POOLED,
    DATABASE_URL_UNPOOLED: DIRECT,
    DEMO_PASSWORD: "a-local-demo-password",
  };

  // prisma/demo-users.ts throws when DEMO_PASSWORD is set off localhost, and the
  // hosted seed must create no demo logins: the seed step gets it blanked, not
  // deleted, so dotenv in prisma/seed.ts cannot fill it back from a .env file.
  it("blanks DEMO_PASSWORD for the seed step", () => {
    const env = stepEnv(SEED_STEP, hosted);
    expect(env.DEMO_PASSWORD).toBe("");
    expect("DEMO_PASSWORD" in env).toBe(true);
  });

  it("blanks DEMO_PASSWORD for the seed step even when it was never set", () => {
    const withoutPassword: Record<string, string | undefined> = {
      VERCEL_ENV: "preview",
      DATABASE_URL: POOLED,
      DATABASE_URL_UNPOOLED: DIRECT,
    };
    expect(stepEnv(SEED_STEP, withoutPassword).DEMO_PASSWORD).toBe("");
  });

  it("keeps the database URLs for the seed step", () => {
    const env = stepEnv(SEED_STEP, hosted);
    expect(env.DATABASE_URL).toBe(POOLED);
    expect(env.DATABASE_URL_UNPOOLED).toBe(DIRECT);
  });

  it("does not change the caller's environment", () => {
    const env = { ...hosted };
    stepEnv(SEED_STEP, env);
    expect(env.DEMO_PASSWORD).toBe("a-local-demo-password");
  });

  it("passes the environment through unchanged for the other steps", () => {
    expect(stepEnv("prisma migrate deploy", hosted)).toEqual(hosted);
    expect(stepEnv("next build", hosted)).toEqual(hosted);
  });
});
