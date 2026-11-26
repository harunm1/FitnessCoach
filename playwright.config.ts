import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { testDatabaseURL } from "./tests/helpers/database-url";

const baseURL = "http://127.0.0.1:13100";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "tsx tests/helpers/mail-server.ts",
      url: "http://127.0.0.1:18027/health",
      reuseExistingServer: false,
    },
    {
      command: "tsx tests/helpers/model-stub.ts",
      url: "http://127.0.0.1:18028/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 13100",
      url: `${baseURL}/sign-in`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: testDatabaseURL(),
        BETTER_AUTH_URL: baseURL,
        BETTER_AUTH_SECRET:
          "fitnesscoach-browser-test-secret-never-use-in-production",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "11026",
        SMTP_SECURE: "false",
        SMTP_FROM: "FitnessCoach <noreply@example.test>",
        SMTP_USER: "",
        SMTP_PASSWORD: "",
        // Browser fixtures must never inherit a developer's R2 bucket, so photo
        // uploads fail safely ("can't be saved right now") instead of storing.
        R2_ACCOUNT_ID: "",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "",
        R2_BUCKET: "",
        // Browser fixtures must never inherit a developer's Stripe sandbox keys.
        STRIPE_SECRET_KEY: "",
        STRIPE_PRICE_ID: "",
        STRIPE_MONTHLY_PRICE_ID: "",
        STRIPE_YEARLY_PRICE_ID: "",
        STRIPE_WEBHOOK_SECRET: "",
        // The coach's model is a loopback stub (D40); no browser fixture may reach a real provider.
        // Demo mode (D12) drops retry waits, so a down provider reaches the fallback at once.
        COACH_PROVIDER: "groq",
        COACH_GROQ_URL: "http://127.0.0.1:18028/chat/completions",
        COACH_DEMO_MODE: "1",
        GROQ_API_KEY: "browser-test-key-not-real",
        GEMINI_API_KEY: "",
        // The program adapter's model (D38): a fixed reply, never used on Vercel. One
        // rep change for day 2, slot 4 (Dumbbell Lunges, 10 to 12 reps).
        PROGRAM_MODEL_STUB: JSON.stringify({
          changes: [
            {
              op: "reps",
              day: 2,
              slot: 4,
              reps: 12,
              reason: "Lunges suit the top of the rep band for a beginner.",
            },
          ],
        }),
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
