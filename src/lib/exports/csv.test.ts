import { describe, expect, it } from "vitest";
import { csvField, toCsv, UTF8_BOM } from "./csv";

const BARBELL_LOAD = 82.5;
const NEGATIVE_NUMBER = -5;

describe("csvField", () => {
  it("leaves a plain value as it is", () => {
    expect(csvField("Bench press")).toBe("Bench press");
    expect(csvField(BARBELL_LOAD)).toBe("82.5");
  });

  it("writes an empty cell for null", () => {
    expect(csvField(null)).toBe("");
  });

  it("quotes a value with a comma", () => {
    expect(csvField("squat, high bar")).toBe('"squat, high bar"');
  });

  it("quotes a value with a quote and doubles the quote", () => {
    expect(csvField('the "big" one')).toBe('"the ""big"" one"');
  });

  it("quotes a value with a line break, of either kind", () => {
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
    expect(csvField("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("quotes a value that has a comma, a quote and a newline together", () => {
    expect(csvField('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it("puts a tab in front of a text cell a spreadsheet would read as a formula", () => {
    for (const start of ["=", "+", "-", "@"]) {
      const risky = `${start}SUM(A1:A9)`;
      expect(csvField(risky)).toBe(`"\t${risky}"`);
    }
    expect(csvField("\tindented")).toBe('"\t\tindented"');
    expect(csvField("\rafter a return")).toBe('"\t\rafter a return"');
  });

  it("guards a risky start and still doubles the quotes inside", () => {
    expect(csvField('=HYPERLINK("http://x","y")')).toBe(
      '"\t=HYPERLINK(""http://x"",""y"")"',
    );
  });

  it("does not change a number, even a negative one", () => {
    expect(csvField(NEGATIVE_NUMBER)).toBe("-5");
  });

  it("does not guard a dash inside the text", () => {
    expect(csvField("push-up")).toBe("push-up");
    expect(csvField("5 - 3")).toBe("5 - 3");
  });
});

describe("toCsv", () => {
  it("starts with a byte-order mark so Excel reads accents", () => {
    expect(toCsv([["a"]]).startsWith(UTF8_BOM)).toBe(true);
  });

  it("ends each row with CRLF, the last one too", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toBe(`${UTF8_BOM}a,b\r\n1,2\r\n`);
  });

  it("keeps a multi-line cell in one record", () => {
    const text = toCsv([["note"], ["one\ntwo"]]);
    expect(text).toBe(`${UTF8_BOM}note\r\n"one\ntwo"\r\n`);
  });
});
