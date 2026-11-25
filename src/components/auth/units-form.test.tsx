import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/account/unit-actions", () => ({ saveUnitPrefs: vi.fn() }));
import { UnitsForm } from "./units-form";

function checkedValues(html: string) {
  return [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => tag.includes("checked"))
    .map((tag) => /value="(\w+)"/.exec(tag)?.[1]);
}

describe("UnitsForm", () => {
  it("offers pounds or kilograms and miles or kilometres", () => {
    const html = renderToStaticMarkup(
      <UnitsForm weightUnit="LB" distanceUnit="MI" />,
    );
    for (const text of ["Weight", "Distance", "kg", "lb", "km", "mi"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('name="weightUnit"');
    expect(html).toContain('name="distanceUnit"');
    expect(html).toContain("Save units");
  });

  it("selects the saved units", () => {
    expect(
      checkedValues(
        renderToStaticMarkup(<UnitsForm weightUnit="LB" distanceUnit="MI" />),
      ),
    ).toEqual(["LB", "MI"]);
    expect(
      checkedValues(
        renderToStaticMarkup(<UnitsForm weightUnit="KG" distanceUnit="KM" />),
      ),
    ).toEqual(["KG", "KM"]);
  });
});
