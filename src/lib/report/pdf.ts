import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import {
  KG_PER_LB,
  fromKg,
  weightLabel,
  type WeightUnit,
} from "@/lib/units/convert";
import { monthLabel } from "./month";
import type { MonthlyReport } from "./summary";

// US Letter, in points. Plain layout with the standard Helvetica fonts, so no font files are
// needed on the server (D34).
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;
const PAGE = { width: LETTER_WIDTH, height: LETTER_HEIGHT } as const;
const MARGIN = 50;
const LINE = 16;
const TITLE_SIZE = 20;
const HEADING_SIZE = 13;
const BODY_SIZE = 11;
const SECOND_COLUMN = 300;
const THIRD_COLUMN = 400;
const INK_LEVEL = 0.1;
const INK = rgb(INK_LEVEL, INK_LEVEL, INK_LEVEL);
const EMPTY_MONTH = "No workouts logged this month.";
const REPLACEMENT = "?";

// Standard fonts draw only Windows-1252 characters and throw on any other, so a name with one
// (a Greek letter, an emoji) is drawn with "?" in its place instead of failing the report.
const drawable = (font: PDFFont, text: string) => {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text, (character) =>
    supported.has(character.codePointAt(0) ?? 0) ? character : REPLACEMENT,
  ).join("");
};

// Writes lines top to bottom and starts a new page when one is full.
class Writer {
  private page: PDFPage;
  private y = PAGE.height - MARGIN;

  constructor(
    private readonly doc: PDFDocument,
    private readonly body: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
  }

  private room(height: number) {
    if (this.y - height >= MARGIN) return;
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
  }

  // One line of text cells: the first at the left margin, the others at their columns.
  line(cells: string[], options: { bold?: boolean; size?: number } = {}) {
    const size = options.size ?? BODY_SIZE;
    const font = options.bold ? this.bold : this.body;
    this.room(LINE);
    const columns = [MARGIN, SECOND_COLUMN, THIRD_COLUMN];
    cells.forEach((cell, index) => {
      this.page.drawText(drawable(font, cell), {
        x: columns[index] ?? MARGIN,
        y: this.y,
        size,
        font,
        color: INK,
      });
    });
    this.y -= LINE;
  }

  gap() {
    this.y -= LINE;
  }
}

const volumeText = (kg: number, unit: WeightUnit) =>
  `${Math.round(unit === "LB" ? kg / KG_PER_LB : kg)} ${weightLabel(unit)}`;
const loadText = (kg: number, unit: WeightUnit) =>
  `${fromKg(kg, unit)} ${weightLabel(unit)}`;

// The monthly progress report as PDF bytes, weights in the user's unit.
export async function renderReportPdf(
  report: MonthlyReport,
  unit: WeightUnit,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`FitnessCoach progress report, ${monthLabel(report.month)}`);
  const writer = new Writer(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
  );

  writer.line(["Monthly progress report"], { bold: true, size: TITLE_SIZE });
  writer.line([monthLabel(report.month)], { size: HEADING_SIZE });
  writer.gap();

  if (report.sessions === 0 && report.totalSets === 0) {
    writer.line([EMPTY_MONTH]);
    return doc.save();
  }

  writer.line([`Sessions: ${report.sessions}`]);
  writer.line([`Sets: ${report.totalSets}`]);
  writer.gap();

  writer.line(["Muscle groups"], { bold: true, size: HEADING_SIZE });
  writer.line(["Muscle", "Sets", "Volume"], { bold: true });
  report.muscles.forEach((row) =>
    writer.line([row.muscle, String(row.sets), volumeText(row.volumeKg, unit)]),
  );
  writer.gap();

  writer.line(["Personal bests"], { bold: true, size: HEADING_SIZE });
  if (report.personalBests.length === 0) {
    writer.line(["No new personal bests this month."]);
  }
  report.personalBests.forEach((best) =>
    writer.line([
      best.exerciseName,
      `${loadText(best.weightKg, unit)} x ${best.reps}`,
      `was ${loadText(best.previousKg, unit)}`,
    ]),
  );
  return doc.save();
}
