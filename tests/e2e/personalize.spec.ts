import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { KEPT_MESSAGE, SAVED_MESSAGE } from "../../src/lib/coach/personalize";
import { testDatabaseURL } from "../helpers/database-url";
import { STUB_PLAN_NAME } from "../helpers/model-stub";

const STUB = "http://127.0.0.1:18028";
const STARTER_NAME = "Starter week before the coach";

// A signed-in Pro athlete who has taken the quiz (two gym days, no kit), has a starter week,
// and has six strength exercises to be planned from. Returns the user's id.
async function seedAthlete(page: Page, db: Client): Promise<string> {
  const prefix = `personalize-browser-${randomUUID()}`;
  const email = `${prefix}@example.test`;
  const password = "Personalize-browser-password-123!";
  const ip = `2001:db8:${randomUUID().slice(0, 4)}::3`;
  // A separate sign-in rate-limit bucket, like quiz-session.spec.ts.
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: "http://127.0.0.1:13100" },
    data: { name: "Personalize Athlete", email, password },
  });
  expect(signup.ok()).toBe(true);
  await db.query(
    'UPDATE "User" SET "emailVerified" = true, tier = \'PRO\' WHERE email = $1',
    [email],
  );
  const {
    rows: [{ id: userId }],
  } = await db.query<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [
    email,
  ]);
  const muscles = [
    "chest",
    "quadriceps",
    "lats",
    "hamstrings",
    "abdominals",
    "shoulders",
  ];
  const exerciseIds = muscles.map((_, i) => `${prefix}-ex-${i}`);
  for (const [i, muscle] of muscles.entries()) {
    await db.query(
      `INSERT INTO "Exercise" (id, name, level, equipment, category, "primaryMuscles", "secondaryMuscles", instructions, images, cues, "commonMistakes")
       VALUES ($1, $2, 'BEGINNER', 'body only', 'strength', $3, '{}', '{}', '{}', '{}', '{}')`,
      [exerciseIds[i], `${prefix} move ${i}`, [muscle]],
    );
  }
  await db.query(
    `INSERT INTO "Profile" ("userId", goal, level, "trainingMode", "daysPerWeek", equipment, "updatedAt")
     VALUES ($1, 'GENERAL_FITNESS', 'BEGINNER', 'GYM', 2, '{}', now())`,
    [userId],
  );
  const {
    rows: [{ id: planId }],
  } = await db.query<{ id: number }>(
    `INSERT INTO "Plan" ("userId", name, source) VALUES ($1, $2, 'DEFAULT') RETURNING id`,
    [userId, STARTER_NAME],
  );
  for (const dayIndex of [0, 1]) {
    const {
      rows: [{ id: dayId }],
    } = await db.query<{ id: number }>(
      `INSERT INTO "PlanDay" ("planId", "dayIndex", name) VALUES ($1, $2, $3) RETURNING id`,
      [planId, dayIndex, `Starter day ${dayIndex + 1}`],
    );
    for (const order of [0, 1]) {
      await db.query(
        `INSERT INTO "PlanExercise" ("planDayId", "exerciseId", "order", sets, reps, "restSeconds") VALUES ($1, $2, $3, 3, 10, 90)`,
        [dayId, exerciseIds[dayIndex * 2 + order], order],
      );
    }
  }
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  return userId;
}

async function activePlan(db: Client, userId: string) {
  const { rows } = await db.query<{ name: string; source: string }>(
    'SELECT name, source FROM "Plan" WHERE "userId" = $1 AND active',
    [userId],
  );
  return rows;
}

test("the Coach page offers Personalize with the coach, and a plan that passes the verifier replaces the week", async ({
  page,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  await db.connect();
  try {
    await page.request.post(`${STUB}/mode?set=ok`);
    const userId = await seedAthlete(page, db);

    await page.goto("/coach");
    await expect(
      page.getByText("Rebuild this week from your profile and history."),
    ).toBeVisible();
    const button = page.getByRole("button", {
      name: "Personalize with the coach",
      exact: true,
    });
    await expect(button).toBeVisible();
    expect(await activePlan(db, userId)).toEqual([
      { name: STARTER_NAME, source: "DEFAULT" },
    ]);

    await button.click();

    await expect(page.getByRole("status")).toHaveText(SAVED_MESSAGE);
    expect(await activePlan(db, userId)).toEqual([
      { name: STUB_PLAN_NAME, source: "COACH" },
    ]);
  } finally {
    await db.end();
  }
});

test("with the provider down the fallback message shows at once and the week stays", async ({
  page,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  await db.connect();
  try {
    await page.request.post(`${STUB}/mode?set=down`);
    const userId = await seedAthlete(page, db);

    await page.goto("/coach");
    const startedAt = Date.now();
    await page
      .getByRole("button", { name: "Personalize with the coach", exact: true })
      .click();

    await expect(page.getByRole("status")).toHaveText(KEPT_MESSAGE, {
      timeout: 5_000,
    });
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(await activePlan(db, userId)).toEqual([
      { name: STARTER_NAME, source: "DEFAULT" },
    ]);
  } finally {
    await page.request.post(`${STUB}/mode?set=ok`);
    await db.end();
  }
});
