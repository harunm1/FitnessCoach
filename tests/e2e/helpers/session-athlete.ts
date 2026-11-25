// A signed-in athlete with one exercise and an open workout, for browser specs of the session
// screen. Rows are removed by the caller (by the email and exercise-id prefix).
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import type { Client } from "pg";

const ORIGIN = "http://127.0.0.1:13100";
const PASSWORD = "Session-browser-password-for-tests-123!";
const PLANNED_SETS = 3;
const DEFAULT_REST_SECONDS = 90;
const PLANNED_REPS = 10;
const IP_SUFFIX_LENGTH = 4;

export type SessionAthlete = {
  workoutId: number;
  exerciseName: string;
  userId: string;
};

export async function signedInAthleteWithWorkout(
  page: Page,
  db: Client,
  prefix: string,
  options: { restSeconds?: number; startedHoursAgo?: number } = {},
): Promise<SessionAthlete> {
  const { restSeconds = DEFAULT_REST_SECONDS, startedHoursAgo = 0 } = options;
  const email = `${prefix}@example.test`;
  const exerciseId = `${prefix}-press`;
  const exerciseName = `${prefix} press`;
  const ip = `2001:db8:${randomUUID().slice(0, IP_SUFFIX_LENGTH)}::1`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await db.query(
    `INSERT INTO "Exercise" (id, name, level, equipment, category, "primaryMuscles", "secondaryMuscles", instructions, images, cues, "commonMistakes")
     VALUES ($1, $2, 'BEGINNER', 'body only', 'strength', '{chest}', '{}', '{}', '{}', '{}', '{}')`,
    [exerciseId, exerciseName],
  );
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: ORIGIN, "x-forwarded-for": ip },
    data: { name: "Timer Athlete", email, password: PASSWORD },
  });
  expect(signup.ok()).toBe(true);
  const {
    rows: [user],
  } = await db.query<{ id: string }>(
    'UPDATE "User" SET "emailVerified" = true WHERE email = $1 RETURNING id',
    [email],
  );
  const {
    rows: [plan],
  } = await db.query<{ id: number }>(
    `INSERT INTO "Plan" ("userId", name, source) VALUES ($1, 'Timer plan', 'DEFAULT') RETURNING id`,
    [user.id],
  );
  const {
    rows: [day],
  } = await db.query<{ id: number }>(
    `INSERT INTO "PlanDay" ("planId", "dayIndex", name) VALUES ($1, 0, 'Timer day') RETURNING id`,
    [plan.id],
  );
  await db.query(
    'INSERT INTO "PlanExercise" ("planDayId", "exerciseId", "order", sets, reps, "restSeconds") VALUES ($1, $2, 0, $3, $4, $5)',
    [day.id, exerciseId, PLANNED_SETS, PLANNED_REPS, restSeconds],
  );
  // A workout that began `startedHoursAgo` hours ago and has been running since. The columns
  // hold UTC without a zone, so now() is converted to UTC whatever the database session zone.
  const {
    rows: [workout],
  } = await db.query<{ id: number }>(
    `INSERT INTO "Workout" ("userId", "planId", "planDayId", "startedAt", "activeSince")
     VALUES ($1, $2, $3, (now() AT TIME ZONE 'UTC') - make_interval(hours => $4::int), (now() AT TIME ZONE 'UTC') - make_interval(hours => $4::int))
     RETURNING id`,
    [user.id, plan.id, day.id, startedHoursAgo],
  );

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/account");
  await page.goto("/session");
  await expect(
    page.getByText("Workout in progress since", { exact: false }),
  ).toBeVisible();
  return { workoutId: workout.id, exerciseName, userId: user.id };
}

export async function logSet(
  page: Page,
  exerciseName: string,
  setNumber: number,
) {
  const exercise = page.locator("li").filter({
    has: page.getByRole("heading", { name: exerciseName, exact: true }),
  });
  await exercise.getByLabel("REPS", { exact: true }).fill("8");
  // New accounts show pounds (D30).
  await exercise.getByLabel("LB", { exact: true }).fill("20");
  await exercise
    .getByRole("button", { name: `Log set ${setNumber}`, exact: true })
    .click();
}

export async function cleanUp(db: Client, prefix: string) {
  await db.query('DELETE FROM "User" WHERE email LIKE $1', [`${prefix}%`]);
  await db.query('DELETE FROM "Exercise" WHERE id LIKE $1', [`${prefix}%`]);
}
