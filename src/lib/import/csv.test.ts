// Tests for the small CSV reader used by the workout import (#131).
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads plain rows", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("reads quoted fields with commas, quotes and line breaks", () => {
    const text = 'a,b\n"x, y","say ""hi"""\n"line1\nline2",z';
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["line1\nline2", "z"],
    ]);
  });

  it("handles CRLF, a leading byte order mark and blank lines", () => {
    expect(parseCsv("\uFEFFa,b\r\n\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c\n,,")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });

  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a,"b\n1,2')).toThrow(/quote/i);
  });
});
