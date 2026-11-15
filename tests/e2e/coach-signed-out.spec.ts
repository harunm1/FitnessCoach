// A signed-out request to /coach must answer with a real 307 to /sign-in, not a streamed 200 (D16, #63).
import { expect, test } from "@playwright/test";

const TEMPORARY_REDIRECT = 307;

test("signed-out GET /coach answers 307 to /sign-in", async ({ request }) => {
  const response = await request.get("/coach", { maxRedirects: 0 });
  expect(response.status()).toBe(TEMPORARY_REDIRECT);
  expect(new URL(response.headers()["location"], "http://x").pathname).toBe(
    "/sign-in",
  );
});
