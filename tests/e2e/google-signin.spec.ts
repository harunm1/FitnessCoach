// D32: without the two Google variables the pages keep working and show no Google button.
import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

["/sign-in", "/sign-up"].forEach((path) => {
  test(`${path} hides Continue with Google when Google is not configured`, async ({
    page,
  }) => {
    test.skip(configured, "Google credentials are set in this environment.");
    await page.goto(path);
    await expect(page.locator("form")).toBeVisible();
    await expect(page.getByText("Continue with Google")).toHaveCount(0);
  });
});

test("a Google error return explains itself on the sign-in page", async ({
  page,
}) => {
  await page.goto("/sign-in?provider=google&error=account_not_linked");
  await expect(page.getByRole("alert")).toContainText("not verified");
});
