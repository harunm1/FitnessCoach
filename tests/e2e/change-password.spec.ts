import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";

async function withAccount(
  page: Page,
  run: (account: {
    email: string;
    password: string;
    db: Client;
  }) => Promise<void>,
) {
  const db = new Client({ connectionString: testDatabaseURL() });
  const email = `password-browser-${randomUUID()}@example.test`;
  const password = "Current-password-browser-123!";
  const ip = `2001:db8:${randomUUID().slice(0, 4)}::1`;
  await db.connect();
  try {
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
    const signup = await page.request.post("/api/auth/sign-up/email", {
      headers: { origin: "http://127.0.0.1:13100", "x-forwarded-for": ip },
      data: { name: "Password Athlete", email, password },
    });
    expect(signup.ok()).toBe(true);
    await db.query(
      'UPDATE "User" SET "emailVerified" = true WHERE email = $1',
      [email],
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await run({ email, password, db });
  } finally {
    try {
      await db.query('DELETE FROM "User" WHERE email = $1', [email]);
    } finally {
      await db.end();
    }
  }
}

test("signed-in password changes stay in a mobile dialog and keep the current session", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await withAccount(page, async ({ email, password }) => {
    const newPassword = "New-password-browser-456!";
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Change password",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      dialog.getByLabel("Current password", { exact: true }),
    ).toBeFocused();
    await dialog.getByLabel("Current password", { exact: true }).fill(password);
    await dialog.getByLabel("New password", { exact: true }).fill(newPassword);
    await dialog
      .getByLabel("Confirm new password", { exact: true })
      .fill("Mismatching-password-123!");
    await dialog
      .getByRole("button", { name: "Save password", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "New passwords must match.",
    );
    await expect(
      dialog.getByLabel("Confirm new password", { exact: true }),
    ).toBeFocused();

    await dialog
      .getByLabel("Confirm new password", { exact: true })
      .fill(newPassword);
    await dialog
      .getByLabel("Current password", { exact: true })
      .fill("Wrong-current-password-123!");
    await dialog
      .getByRole("button", { name: "Save password", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Your current password is incorrect.",
    );
    await expect(
      dialog.getByLabel("Current password", { exact: true }),
    ).toBeFocused();
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390);
    await dialog.screenshot({
      path: test.info().outputPath("change-password-mobile-dark.png"),
      animations: "disabled",
    });

    await dialog.getByLabel("Current password", { exact: true }).fill(password);
    await dialog
      .getByRole("button", { name: "Save password", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toContainText("Password updated");
    await expect(
      dialog.getByLabel("Current password", { exact: true }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change password", exact: true }),
    ).toBeFocused();
    await page.reload();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Invalid email or password",
    );
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
  });
});

test("the password dialog traps focus and clears sensitive fields on cancel", async ({
  page,
}) => {
  await withAccount(page, async ({ password }) => {
    const trigger = page.getByRole("button", {
      name: "Change password",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Change password",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByLabel("Current password", { exact: true }),
    ).toBeFocused();
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await dialog.getByLabel("Current password", { exact: true }).fill(password);
    await dialog.getByLabel("Show passwords", { exact: true }).check();
    await expect(
      dialog.getByLabel("Current password", { exact: true }),
    ).toHaveAttribute("type", "text");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    for (const label of [
      "Current password",
      "New password",
      "Confirm new password",
    ])
      await expect(dialog.getByLabel(label, { exact: true })).toHaveValue("");
    await expect(
      dialog.getByLabel("Current password", { exact: true }),
    ).toBeFocused();
    await expect(
      dialog.getByLabel("Current password", { exact: true }),
    ).toHaveAttribute("type", "password");
    await dialog.screenshot({
      path: test.info().outputPath("change-password-desktop-light.png"),
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await trigger.click();
    await page.mouse.click(5, 5);
    await expect(dialog).not.toBeVisible();
  });
});

test("expired sessions require sign-in before or during a password change", async ({
  page,
}) => {
  await withAccount(page, async ({ email, password, db }) => {
    const expire = () =>
      db.query(
        'UPDATE "Session" SET "expiresAt" = $2 WHERE "userId" = (SELECT id FROM "User" WHERE email = $1)',
        [email, new Date(0)],
      );
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Change password",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expire();
    await dialog.getByLabel("Current password", { exact: true }).fill(password);
    await dialog
      .getByLabel("New password", { exact: true })
      .fill("Expired-session-password-456!");
    await dialog
      .getByLabel("Confirm new password", { exact: true })
      .fill("Expired-session-password-456!");
    await dialog
      .getByRole("button", { name: "Save password", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sign-in\?reason=session-expired$/);
    await expect(page.getByRole("status")).toContainText(
      "Your session has expired",
    );
    await expect(
      page.getByRole("link", { name: "Forgot password?", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expire();
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sign-in\?reason=session-expired$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
