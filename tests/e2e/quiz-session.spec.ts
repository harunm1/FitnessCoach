import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import { visibleTextBelowProjectorSize } from "./helpers/projector-readability";

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
  const ip = `2001:db8:${randomUUID().slice(0, 4)}::1`;
  await db.connect();
  try {
    // Keep signup and browser login in a rate-limit bucket separate from other tests.
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
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
          "x-forwarded-for": ip,
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
    const [login] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/auth/sign-in/email" &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Sign in", exact: true }).click(),
    ]);
    expect(login.status(), "Quiz fixture login should succeed").toBe(200);
    await expect(page).toHaveURL(/\/account$/);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/session?userId=${other.id}&planId=${privatePlan.id}`);
    await expect(
      page.getByRole("heading", { name: "Set up your profile first" }),
    ).toBeVisible();
    const mainNav = page.getByRole("navigation", { name: "Main" });
    const photosLink = mainNav.getByRole("link", {
      name: "Photos",
      exact: true,
    });
    await expect(photosLink).toBeVisible();
    expect(
      await photosLink.evaluate((link) => {
        const nav = link.closest("nav");
        const linkRect = link.getBoundingClientRect();
        const navRect = nav?.getBoundingClientRect();
        return Boolean(
          nav &&
          navRect &&
          nav.scrollWidth <= nav.clientWidth &&
          linkRect.left >= navRect.left &&
          linkRect.right <= navRect.right,
        );
      }),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByText("Other athlete private plan", { exact: true }),
    ).toHaveCount(0);

    await page.goto("/onboarding");
    await page
      .getByLabel("How would you describe your experience?")
      .selectOption("BEGINNER");
    await page.getByLabel("Bodyweight", { exact: true }).check();
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
    // Start lands on the workout's own page (D43), which holds the clock and Finish.
    await expect(page).toHaveURL(/\/session\/\d+$/);
    await expect(
      page.getByRole("region", { name: "Workout controls" }),
    ).toBeVisible();
    expect(await visibleTextBelowProjectorSize(page)).toEqual([]);

    await expect(
      page.getByText("Elapsed workout time", { exact: true }),
    ).toBeVisible();
    const elapsed = page.getByRole("timer");
    const firstElapsed = await elapsed.textContent();
    await expect(elapsed).not.toHaveText(firstElapsed!);
    await page.reload();
    await expect(page.getByRole("timer")).toBeVisible();

    const exercise = page.locator("li").filter({
      has: page.getByRole("heading", { name: pressName, exact: true }),
    });
    await exercise.getByLabel("REPS", { exact: true }).fill("8");
    await exercise.getByLabel("LB", { exact: true }).fill("25");
    await exercise.getByLabel("Pain during", { exact: true }).fill("6");
    await exercise
      .getByRole("button", { name: "Log set 1", exact: true })
      .click();
    await expect(
      exercise.getByRole("button", { name: "Log set 2", exact: true }),
    ).toBeDisabled();
    await expect(
      exercise.getByText(/Set 1: 8 reps.*pain 6\/10 during/),
    ).toBeVisible();
    await exercise
      .getByRole("button", { name: "Correct logged set 1", exact: true })
      .click();
    await exercise.getByLabel("Pain during", { exact: true }).fill("");
    await exercise
      .getByRole("button", { name: "Save correction for set 1", exact: true })
      .click();
    await expect(
      exercise.getByRole("button", { name: "Log set 2", exact: true }),
    ).toBeEnabled();
    await expect(
      exercise.getByLabel("Pain during", { exact: true }),
    ).toHaveValue("");
    await expect(
      exercise.getByLabel("Pain this morning (before workout)", {
        exact: true,
      }),
    ).toHaveValue("");
    await expect(exercise.getByRole("status")).toHaveCount(0);
    await expect(
      page.getByText("Set 1: 8 reps · 25 lb", { exact: true }),
    ).toBeVisible();
    // The running box is not on the workout page any more (D43).
    await expect(page.getByLabel("Distance (km)", { exact: true })).toHaveCount(
      0,
    );
    await page
      .getByRole("button", { name: "Finish workout", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Start next workout", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Workout duration", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Elapsed workout time", { exact: true }),
    ).toHaveCount(0);

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
    expect(saved.distanceKm).toBeNull();
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
