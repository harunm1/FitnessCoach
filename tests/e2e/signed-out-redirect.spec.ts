// A signed-out request to a guarded page must answer with a real 307 to /sign-in, not a streamed 200 (D16, #72).
import { expect, test } from "@playwright/test";

// A loading boundary above a page that redirects makes Next.js start streaming a 200
// before the page runs, so the redirect then arrives only as a refresh inside the body.
const TEMPORARY_REDIRECT = 307;
const GUARDED_PATHS = ["/account", "/session", "/onboarding"];

GUARDED_PATHS.forEach((path) => {
  test(`signed-out GET ${path} answers 307 to /sign-in`, async ({
    request,
  }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(TEMPORARY_REDIRECT);
    expect(new URL(response.headers()["location"], "http://x").pathname).toBe(
      "/sign-in",
    );
  });
});
