import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { renderReportPdf } from "./pdf";
import type { MonthlyReport } from "./summary";

const SESSIONS = 12;
const SETS = 90;
const VOLUME_KG = 4536; // 10,000 lb
const BEST_KG = 100;
const PREVIOUS_KG = 95;
const REPS = 5;
const MANY = 120;
const HEX_BASE = 16;
const HEX_WIDTH = 2;
const PDF_MAGIC_LENGTH = 5;

const report: MonthlyReport = {
  month: "2026-11",
  sessions: SESSIONS,
  totalSets: SETS,
  muscles: [{ muscle: "chest", sets: SETS, volumeKg: VOLUME_KG }],
  personalBests: [
    {
      exerciseName: "Bench Press",
      weightKg: BEST_KG,
      reps: REPS,
      previousKg: PREVIOUS_KG,
    },
  ],
};

// Standard-font text is written as hex codes of the characters; this is what a line looks like.
const hex = (text: string) =>
  Array.from(text, (c) =>
    c.charCodeAt(0).toString(HEX_BASE).toUpperCase().padStart(HEX_WIDTH, "0"),
  ).join("");
// The text drawn on the pages: the page content streams are compressed, so they are opened first.
async function pdfText(bytes: Uint8Array): Promise<string> {
  const opened = await PDFDocument.load(bytes);
  return opened.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter((object) => object instanceof PDFRawStream)
    .map((stream) =>
      Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1"),
    )
    .join("");
}
const text = async (r: MonthlyReport, unit: "KG" | "LB" = "LB") =>
  pdfText(await renderReportPdf(r, unit));

describe("renderReportPdf", () => {
  it("makes a PDF that opens", async () => {
    const bytes = await renderReportPdf(report, "LB");
    expect(Buffer.from(bytes).subarray(0, PDF_MAGIC_LENGTH).toString()).toBe(
      "%PDF-",
    );
    const opened = await PDFDocument.load(bytes);
    expect(opened.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("states the month, the sessions and the sets", async () => {
    const out = await text(report);
    expect(out).toContain(hex("November 2026"));
    expect(out).toContain(hex(`Sessions: ${SESSIONS}`));
    expect(out).toContain(hex(`Sets: ${SETS}`));
  });

  it("shows volume and the best in the user's unit", async () => {
    expect(await text(report, "LB")).toContain(hex("10000 lb"));
    expect(await text(report, "LB")).toContain(hex("220.5 lb x 5"));
    expect(await text(report, "KG")).toContain(hex("4536 kg"));
  });

  it("says so when there is nothing to show", async () => {
    const out = await text({
      ...report,
      sessions: 0,
      totalSets: 0,
      muscles: [],
      personalBests: [],
    });
    expect(out).toContain(hex("No workouts logged this month."));
  });

  it("does not fail on a name the standard font cannot draw", async () => {
    const odd = {
      ...report,
      personalBests: [
        { ...report.personalBests[0], exerciseName: "Squat Ω \u{1F4AA}" },
      ],
    };
    const bytes = await renderReportPdf(odd, "KG");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(await pdfText(bytes)).toContain(hex("Squat ? ?"));
  });

  it("goes on to a second page when the list is long", async () => {
    const many = {
      ...report,
      muscles: Array.from({ length: MANY }, (_, index) => ({
        muscle: `muscle-${index}`,
        sets: 1,
        volumeKg: 1,
      })),
    };
    const opened = await PDFDocument.load(await renderReportPdf(many, "KG"));
    expect(opened.getPageCount()).toBeGreaterThan(1);
  });
});
