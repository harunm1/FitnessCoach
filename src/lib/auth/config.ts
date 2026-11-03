import { z } from "zod";

const authEnvironment = z.object({
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .refine((value) => value.trim().length >= 32),
  BETTER_AUTH_URL: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  }, "Use HTTPS except for local development."),
});

export function readAuthConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const parsed = authEnvironment.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      "Configure BETTER_AUTH_URL and a BETTER_AUTH_SECRET of at least 32 characters. Use HTTPS outside localhost.",
    );
  }
  const url = new URL(parsed.data.BETTER_AUTH_URL);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "BETTER_AUTH_URL must be the application origin without credentials, a path, query, or fragment.",
    );
  }
  return { baseURL: url.origin, secret: parsed.data.BETTER_AUTH_SECRET };
}

export function readMailConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const port = Number(env.SMTP_PORT || 1025);
  if (
    !env.SMTP_HOST ||
    !env.SMTP_FROM ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "Configure SMTP_HOST, SMTP_PORT and SMTP_FROM for verification and recovery emails.",
    );
  }
  if (env.SMTP_SECURE && !["true", "false"].includes(env.SMTP_SECURE)) {
    throw new Error("SMTP_SECURE must be true or false.");
  }
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    throw new Error("Set SMTP_USER and SMTP_PASSWORD together.");
  }
  return {
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE === "true",
    from: env.SMTP_FROM,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD! }
      : undefined,
  };
}
