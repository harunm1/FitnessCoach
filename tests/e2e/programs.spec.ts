// Program templates in the browser (D38). The test server has no model key, so this is
// the "coach unavailable" path: the template comes back at once with a plain note and
// the rule swaps for the user's kit. Reverting a needed swap makes the server refuse the
// save and say why; keeping it saves the program, which then shows in its folder.
// Reverting a coach change and saving is covered by the component and integration
// tests (ProgramReview.test.tsx, tests/integration/programs.test.ts).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";

type FixtureExercise = {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

test("an athlete picks a template, sees the fitted changes, reverts one and saves the program", async ({
  page,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  const prefix = `programs-browser-${randomUUID()}`;
  const email = `${prefix}@example.test`;
  const password = "Programs-browser-password-for-tests-123!";
  const ip = `2001:db8:${randomUUID().slice(0, 4)}::1`;
  const library: FixtureExercise[] = JSON.parse(
    readFileSync("eval/fixtures-library.json", "utf8"),
  );
  let inserted: string[] = [];
  await db.connect();
  try {
    // The template names real free-exercise-db ids; add the ones this database lacks
    // and remove exactly those afterwards (other specs' starter plans must not see them).
    const { rows } = await db.query<{ id: string }>(
      'SELECT id FROM "Exercise" WHERE id = ANY($1::text[])',
      [library.map((e) => e.id)],
    );
    const existing = new Set(rows.map((r) => r.id));
    const missing = library.filter((e) => !existing.has(e.id));
    inserted = missing.map((e) => e.id);
    for (const e of missing) {
      await db.query(
        `INSERT INTO "Exercise" (id, name, level, equipment, category, "primaryMuscles", "secondaryMuscles", instructions, images, cues, "commonMistakes")
         VALUES ($1, $2, 'BEGINNER', $3, $4, $5, $6, '{}', '{}', '{}', '{}')`,
        [
          e.id,
          e.name,
          e.equipment,
          e.category,
          e.primaryMuscles,
          e.secondaryMuscles,
        ],
      );
    }

    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
    const signup = await page.request.post("/api/auth/sign-up/email", {
      headers: { origin: "http://127.0.0.1:13100", "x-forwarded-for": ip },
      data: { name: "Program Athlete", email, password },
    });
    expect(signup.ok()).toBe(true);
    const {
      rows: [user],
    } = await db.query<{ id: string }>(
      'UPDATE "User" SET "emailVerified" = true WHERE email = $1 RETURNING id',
      [email],
    );
    // Dumbbells only: every barbell lift in the template needs a swap.
    await db.query(
      `INSERT INTO "Profile" ("userId", goal, level, "daysPerWeek", equipment, "updatedAt")
       VALUES ($1, 'STRENGTH', 'BEGINNER', 3, '{dumbbell}', now())`,
      [user.id],
    );

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);

    await page.goto("/programs");
    await expect(
      page.getByRole("heading", { name: "Programs", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("No programs yet")).toBeVisible();

    await page
      .getByRole("button", {
        name: "Start from Full body, 3 days (beginner)",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Changes to Full body, 3 days (beginner)",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("could not adapt this template just now"),
    ).toBeVisible();
    const keep = page.getByRole("checkbox", { name: "Keep this change" });
    expect(await keep.count()).toBeGreaterThan(0);
    await expect(
      page.getByText("Fitted to your equipment").first(),
    ).toBeVisible();
    const dayA = page.getByRole("region", { name: "Full body A" });
    await expect(dayA.getByText(/^Barbell Squat:/)).toHaveCount(0);

    // Revert the first change: the barbell lift comes back, and the server refuses it.
    await keep.first().uncheck();
    await expect(dayA.getByText(/^Barbell Squat: 3 x 8$/)).toBeVisible();
    await page
      .getByRole("button", { name: "Save program", exact: true })
      .click();
    // Next.js adds its own empty role="alert" route announcer, so pick ours by text.
    const refusal = page
      .getByRole("alert")
      .filter({ hasText: "cannot be saved yet" });
    await expect(refusal).toBeVisible();
    await expect(refusal).toContainText("needs barbell");

    // Keep it again and move day A to Tuesday: the program saves.
    await keep.first().check();
    await page
      .getByRole("combobox", { name: "Weekday for Full body A", exact: true })
      .selectOption("TUE");
    await page
      .getByRole("button", { name: "Save program", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Program saved");

    await page.reload();
    const folder = page
      .locator("details")
      .filter({
        hasText: "Full body, 3 days (beginner)",
      })
      .first();
    await expect(folder.getByText("Active", { exact: true })).toBeVisible();
    await expect(folder.getByText("Tuesday").first()).toBeVisible();
    await expect(folder.getByText(/Deload week, every 8 weeks/)).toBeVisible();

    const {
      rows: [plan],
    } = await db.query<{ source: string; templateId: string }>(
      'SELECT source, "templateId" FROM "Plan" WHERE "userId" = $1 AND active',
      [user.id],
    );
    expect(plan).toEqual({
      source: "TEMPLATE",
      templateId: "full-body-3-beginner",
    });
  } finally {
    try {
      // The user first: plans and plan exercises go with it by cascade.
      await db.query('DELETE FROM "User" WHERE email = $1', [email]);
      await db.query('DELETE FROM "Exercise" WHERE id = ANY($1::text[])', [
        inserted,
      ]);
    } finally {
      await db.end();
    }
  }
});
