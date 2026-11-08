import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";

test("the quiz and session pages require sign-in", async ({ page }) => {
  for (const path of ["/onboarding", "/session"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back", exact: true }),
    ).toBeVisible();
  }
});

test("an athlete completes the quiz and logs a session without touching another user's workout", async ({
  page,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  const prefix = `quiz-browser-${randomUUID()}`;
  const password = "Quiz-browser-password-for-tests-123!";
  const ownEmail = `${prefix}-first@example.test`;
  const otherEmail = `${prefix}-second@example.test`;
  const exerciseIds = [`${prefix}-press`, `${prefix}-squat`];
  const pressName = `${prefix} press`;
  await db.connect();
  try {
    for (const [index, id] of exerciseIds.entries()) {
      await db.query(
        `INSERT INTO "Exercise" (id, name, level, equipment, category, "primaryMuscles", "secondaryMuscles", instructions, images, cues, "commonMistakes")
         VALUES ($1, $2, 'BEGINNER', 'body only', 'strength', $3, '{}', '{}', '{}', '{}', '{}')`,
        [
          id,
          index ? `${prefix} squat` : pressName,
          [index ? "quadriceps" : "chest"],
        ],
      );
    }
    for (const email of [ownEmail, otherEmail]) {
      const signup = await page.request.post("/api/auth/sign-up/email", {
        headers: {
          origin: "http://127.0.0.1:13100",
          "x-forwarded-for": `2001:db8:${randomUUID().slice(0, 4)}::1`,
        },
        data: { name: "Quiz Athlete", email, password },
      });
      expect(signup.ok()).toBe(true);
      await db.query(
        'UPDATE "User" SET "emailVerified" = true WHERE email = $1',
        [email],
      );
    }
    const {
      rows: [owner],
    } = await db.query<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1',
      [ownEmail],
    );
    const {
      rows: [other],
    } = await db.query<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1',
      [otherEmail],
    );
    const {
      rows: [privatePlan],
    } = await db.query<{ id: number }>(
      `INSERT INTO "Plan" ("userId", name, source) VALUES ($1, 'Other athlete private plan', 'DEFAULT') RETURNING id`,
      [other.id],
    );
    const {
      rows: [privateDay],
    } = await db.query<{ id: number }>(
      `INSERT INTO "PlanDay" ("planId", "dayIndex", name) VALUES ($1, 0, 'Other athlete private day') RETURNING id`,
      [privatePlan.id],
    );
    await db.query(
      'INSERT INTO "PlanExercise" ("planDayId", "exerciseId", "order", sets, reps, "restSeconds") VALUES ($1, $2, 0, 3, 10, 90)',
      [privateDay.id, exerciseIds[0]],
    );
    const {
      rows: [privateWorkout],
    } = await db.query<{ id: number }>(
      'INSERT INTO "Workout" ("userId", "planId", "planDayId") VALUES ($1, $2, $3) RETURNING *',
      [other.id, privatePlan.id, privateDay.id],
    );

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(ownEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.goto(`/session?userId=${other.id}&planId=${privatePlan.id}`);
    await expect(
      page.getByRole("heading", { name: "Set up your profile first" }),
    ).toBeVisible();
    await expect(
      page.getByText("Other athlete private plan", { exact: true }),
    ).toHaveCount(0);

    await page.goto("/onboarding");
    await page
      .getByLabel("How would you describe your experience?")
      .selectOption("BEGINNER");
    await page.getByLabel("Bodyweight only", { exact: true }).check();
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("have been saved");
    await page
      .getByRole("link", { name: "View your plan", exact: true })
      .click();
    await expect(
      page.getByText("3-day starter plan", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Other athlete private plan", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Start workout", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Workout in progress");

    const exercise = page.locator("li").filter({
      has: page.getByRole("heading", { name: pressName, exact: true }),
    });
    await exercise.getByLabel("REPS", { exact: true }).fill("8");
    await exercise.getByLabel("KG", { exact: true }).fill("12");
    await exercise
      .getByRole("button", { name: "Log set 1", exact: true })
      .click();
    await expect(
      page.getByText("Set 1: 8 reps · 12 kg", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Distance (km)", { exact: true }).fill("5.25");
    await page.getByLabel("MINUTES", { exact: true }).fill("30");
    await page.getByLabel("SECONDS", { exact: true }).fill("15");
    await page.getByRole("button", { name: "Save run", exact: true }).click();
    await expect(
      page.getByText("Saved run: 5.25 km in 30 min 15 sec", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Finish workout", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Start next workout", exact: true }),
    ).toBeVisible();

    const {
      rows: [saved],
    } = await db.query<{
      id: number;
      finishedAt: Date | null;
      distanceKm: string | null;
      durationSeconds: number | null;
    }>(
      'SELECT id, "finishedAt", "distanceKm", "durationSeconds" FROM "Workout" WHERE "userId" = $1',
      [owner.id],
    );
    expect(saved.finishedAt).not.toBeNull();
    expect(saved.distanceKm).toBe("5.25");
    expect(saved.durationSeconds).toBe(1815);
    const countSets = async (workoutId: number) => {
      const {
        rows: [row],
      } = await db.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM "SetLog" WHERE "workoutId" = $1',
        [workoutId],
      );
      return row.count;
    };
    expect(await countSets(saved.id)).toBe(1);
    expect(
      (
        await db.query('SELECT * FROM "Workout" WHERE id = $1', [
          privateWorkout.id,
        ])
      ).rows[0],
    ).toEqual(privateWorkout);
    expect(await countSets(privateWorkout.id)).toBe(0);
    expect(
      (
        await db.query('SELECT active FROM "Plan" WHERE id = $1', [
          privatePlan.id,
        ])
      ).rows[0].active,
    ).toBe(true);
  } finally {
    try {
      await db.query('DELETE FROM "User" WHERE email = ANY($1::text[])', [
        [ownEmail, otherEmail],
      ]);
      await db.query('DELETE FROM "Exercise" WHERE id = ANY($1::text[])', [
        exerciseIds,
      ]);
    } finally {
      await db.end();
    }
  }
});
