// CSV text for the data exports (D33): RFC 4180 quoting plus a guard against spreadsheet formulas.
export type Cell = string | number | null;

// Excel reads a file without this mark as the local code page and garbles accents.
export const UTF8_BOM = "﻿";

// A text cell that starts with one of these is read by a spreadsheet as a formula
// (OWASP, CSV Injection). A leading tab inside the quoted cell turns it into text and,
// unlike an apostrophe, still works in Excel after the file is saved and reopened.
const FORMULA_STARTS = new Set(["=", "+", "-", "@", "\t", "\r"]);
const TEXT_GUARD = "\t";

// A field with any of these has to be quoted.
const QUOTE_TRIGGERS = [",", '"', "\r", "\n"];

const quote = (text: string) => `"${text.replaceAll('"', '""')}"`;
const needsQuotes = (text: string) =>
  QUOTE_TRIGGERS.some((character) => text.includes(character));

// One cell as it is written in the file. Numbers are data, never guarded; only text is.
export function csvField(cell: Cell): string {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  const guarded = FORMULA_STARTS.has(cell.charAt(0))
    ? `${TEXT_GUARD}${cell}`
    : cell;
  return guarded !== cell || needsQuotes(guarded) ? quote(guarded) : guarded;
}

// The whole file: a byte-order mark, then one CRLF-ended line per row (header first).
export function toCsv(rows: Cell[][]): string {
  const lines = rows.map((row) => row.map(csvField).join(","));
  return UTF8_BOM + lines.map((line) => `${line}\r\n`).join("");
}
