import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

type Mail = { subject: string; text: string };
async function emailLink(
  request: APIRequestContext,
  email: string,
  subject: string,
) {
  let selected: Mail | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `http://127.0.0.1:18027/messages?to=${encodeURIComponent(email)}`,
        );
        const messages = (await response.json()) as Mail[];
        selected = messages.findLast((mail) =>
          mail.subject.startsWith(subject),
        );
        return Boolean(selected);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return selected!.text.match(/https?:\/\/\S+/)![0];
}

test("signed-out users cannot access the account page", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Your account" })).toHaveCount(
    0,
  );
});
test("invalid recovery links give an actionable message", async ({ page }) => {
  await page.goto("/reset-password?error=INVALID_TOKEN");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "invalid or expired",
  );
  await expect(
    page.getByRole("link", { name: "Request a new reset link" }),
  ).toBeVisible();
});
test("invalid verification links offer a new email", async ({ page }) => {
  await page.goto("/api/auth/verify-email?token=invalid&callbackURL=/sign-in");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "invalid or expired",
  );
  await expect(
    page.getByRole("link", { name: "Resend verification email" }),
  ).toBeVisible();
});
test("signup is usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-up");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("signup-mobile.png"),
    fullPage: true,
  });
});
test("signup, email verification, login, password recovery and logout", async ({
  page,
  request,
}) => {
  const email = `browser-${randomUUID()}@example.test`;
  const password = "Browser-test-password-123!";
  const newPassword = "Replacement-browser-password-456!";
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Browser Athlete");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/verify-email$/);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Verify your email",
  );
  await page.getByRole("link", { name: "Resend verification email" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Resend verification email", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("a new link");
  await page.goto(await emailLink(request, email, "Verify"));
  await expect(page).toHaveURL(/\/sign-in\?verified=1$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  const reset = await emailLink(request, email, "Reset");
  await page.goto(reset);
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText("has been reset");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
});
