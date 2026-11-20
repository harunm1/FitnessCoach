import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../src/generated/prisma/client";
import { seedLocalDemoUsers } from "./demo-users";

const password = "Local-demo-password-for-tests!";
const databaseURL = "postgresql://fixture:fixture@localhost:5432/demo_test";
const transaction = vi.fn();
const database = { $transaction: transaction } as unknown as PrismaClient;

beforeEach(() => vi.clearAllMocks());

describe("local demo seed safeguards", () => {
  it("does nothing unless a password is explicitly supplied", async () => {
    expect(await seedLocalDemoUsers(database, {})).toEqual([]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["production", databaseURL],
    [
      "development",
      "postgresql://fixture:fixture@remote.example.test/demo_test",
    ],
    ["development", "https://localhost/demo_test"],
    ["development", "not a connection string"],
  ])(
    "rejects an unsafe environment or database before writing (%s)",
    async (environment, url) => {
      await expect(
        seedLocalDemoUsers(database, {
          password,
          databaseURL: url,
          environment,
        }),
      ).rejects.toThrow("localhost PostgreSQL");
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid password without including it in the error", async () => {
    await expect(
      seedLocalDemoUsers(database, { password: "short", databaseURL }),
    ).rejects.toThrow("12–128 characters");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not expose credential values from a failed database write", async () => {
    transaction.mockRejectedValueOnce(
      new Error(`private write: ${password}, secret-hash`),
    );
    const error = await seedLocalDemoUsers(database, {
      password,
      databaseURL,
    }).catch((cause: Error) => cause);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(
      "Apply the committed migrations",
    );
    expect((error as Error).message).not.toContain(password);
    expect((error as Error).message).not.toContain("secret-hash");
  });
});
