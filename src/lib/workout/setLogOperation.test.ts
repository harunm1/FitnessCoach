import { describe, expect, it } from "vitest";
import { getSetLogOperation } from "./setLogOperation";

describe("getSetLogOperation", () => {
  it("creates only the next sequential set", () => {
    expect(getSetLogOperation(1, [], 3)).toBe("create");
    expect(getSetLogOperation(2, [1], 3)).toBe("create");
    expect(getSetLogOperation(3, [1], 3)).toBeNull();
  });

  it("updates a set number that was already logged, making retries idempotent", () => {
    expect(getSetLogOperation(2, [1, 2], 3)).toBe("update");
  });

  it("rejects set numbers outside the planned range", () => {
    expect(getSetLogOperation(0, [], 3)).toBeNull();
    expect(getSetLogOperation(4, [1, 2], 3)).toBeNull();
  });
});
