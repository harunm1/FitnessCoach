import { describe, expect, it } from "vitest";
import { attachmentDisposition } from "./disposition";

const QUOTES_AROUND_ONE_NAME = 2;

describe("attachmentDisposition", () => {
  it("asks the browser to save the file under the name", () => {
    expect(attachmentDisposition("fitnesscoach-workouts-2026-11-25.csv")).toBe(
      `attachment; filename="fitnesscoach-workouts-2026-11-25.csv"; filename*=UTF-8''fitnesscoach-workouts-2026-11-25.csv`,
    );
  });

  it("can never close the quoted name early or start a second header", () => {
    const value = attachmentDisposition('a"; x=1\r\nSet-Cookie: y.csv');
    expect(value.includes("\r") || value.includes("\n")).toBe(false);
    expect(value.split('"').length - 1).toBe(QUOTES_AROUND_ONE_NAME);
  });

  it("drops path pieces from the name", () => {
    expect(attachmentDisposition("../../etc/passwd")).toContain(
      'filename="etc_passwd"',
    );
    expect(attachmentDisposition("a\\b.csv")).toContain('filename="a_b.csv"');
  });

  it("gives non-ASCII text a plain fallback and a percent-encoded name", () => {
    const value = attachmentDisposition("séance.csv");
    expect(value).toContain('filename="s_ance.csv"');
    expect(value).toContain("filename*=UTF-8''s%C3%A9ance.csv");
  });

  it("falls back to a fixed name when nothing usable is left", () => {
    expect(attachmentDisposition("///")).toContain('filename="download"');
  });
});
