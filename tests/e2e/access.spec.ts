import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import { TRIAL_DURATION_MS } from "../../src/lib/auth/access-policy";

test("trial activation, expiry and tier changes use fresh server permissions", async ({
  page,
  request,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  const email = `trial-browser-${randomUUID()}@example.test`;
  const password = "Trial-browser-password-123!";
  await db.connect();
  try {
    const signup = await request.post("/api/auth/sign-up/email", {
      headers: { origin: "http://127.0.0.1:13100" },
      data: { name: "Trial Athlete", email, password },
    });
    expect(signup.ok()).toBe(true);
    // Verification delivery is covered by auth.spec.ts; this fixture isolates tiers.
    await db.query(
      'UPDATE "User" SET "emailVerified" = true WHERE email = $1',
      [email],
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByText("Current tier: FREE", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Coach access: Not active", { exact: true }),
    ).toBeVisible();
    await page.goto("/account?billing=success");
    await expect(
      page.getByText("Current tier: FREE", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your membership" }),
    ).toBeVisible();
    await expect(
      page.getByText("New subscriptions aren’t available right now.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Upgrade to PRO (test)" }),
    ).toHaveCount(0);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width: 320, height: 844 });
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Your membership" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`membership-${colorScheme}-mobile.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/account");
    const before = Date.now();
    await page
      .getByRole("button", { name: "Start free trial", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Your free trial is active",
    );
    await expect(
      page.getByText("Current tier: TRIAL", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Coach access: Enabled", { exact: true }),
    ).toBeVisible();
    const {
      rows: [account],
    } = await db.query<{ trialEndsAt: Date }>(
      'SELECT "trialEndsAt" FROM "User" WHERE email = $1',
      [email],
    );
    expect(account.trialEndsAt!.getTime()).toBeGreaterThanOrEqual(
      before + TRIAL_DURATION_MS,
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Start free trial", exact: true }),
    ).toHaveCount(0);

    await db.query('UPDATE "User" SET "trialEndsAt" = $2 WHERE email = $1', [
      email,
      new Date(Date.now() - 1000),
    ]);
    await page.reload();
    await expect(
      page.getByText("Current tier: FREE", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Coach access: Not active", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start free trial", exact: true }),
    ).toHaveCount(0);

    // Isolated fixtures only: production paid entitlements come from Stripe.
    await db.query(
      'INSERT INTO "BillingAccount" ("userId", "stripeCustomerId", "updatedAt") SELECT id, $2, NOW() FROM "User" WHERE email = $1',
      [email, `cus_browser_${randomUUID()}`],
    );
    await page.reload();
    await expect(
      page.getByText("Current tier: FREE", { exact: true }),
    ).toBeVisible();
    await db.query("UPDATE \"User\" SET tier = 'PRO' WHERE email = $1", [
      email,
    ]);
    await db.query(
      'UPDATE "BillingAccount" SET "status" = $2, "paidUntil" = $3 WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)',
      [email, "active", new Date(Date.now() + 86400000)],
    );
    // A confirmed server-side upgrade refreshes an open account on focus.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByText("Current tier: PRO", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Coach access: Enabled", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Content management access: Enabled", { exact: true }),
    ).toHaveCount(0);

    await db.query(
      'UPDATE "BillingAccount" SET "paidUntil" = $2 WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)',
      [email, new Date(Date.now() - 1000)],
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByText("Current tier: FREE", { exact: true }),
    ).toBeVisible();
    await db.query("UPDATE \"User\" SET tier = 'ADMIN' WHERE email = $1", [
      email,
    ]);
    await page.reload();
    await expect(
      page.getByText("Content management access: Enabled", { exact: true }),
    ).toBeVisible();
  } finally {
    try {
      await db.query('DELETE FROM "User" WHERE email = $1', [email]);
    } finally {
      await db.end();
    }
  }
});
