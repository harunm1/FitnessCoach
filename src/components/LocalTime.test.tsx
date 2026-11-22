// @vitest-environment jsdom
// Tests for the local time component (#141, #144): the first render is stable for the server,
// then the viewer's own time zone is used.
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { formatLocal } from "@/lib/format/localTime";
import LocalTime from "./LocalTime";

afterEach(cleanup);
const iso = "2026-11-29T22:48:02.000Z";

describe("LocalTime", () => {
  it("renders Toronto time on the server, as a time element with the instant", () => {
    const html = renderToStaticMarkup(<LocalTime iso={iso} kind="datetime" />);
    expect(html).toContain(`dateTime="${iso}"`);
    expect(html).toContain("Sunday, November 29, 2026 at 5:48 PM");
    expect(html).not.toMatch(/GMT/);
  });

  it("switches to the viewer's own zone after mounting", () => {
    render(<LocalTime iso={iso} kind="time" />);
    expect(screen.getByText(formatLocal(new Date(iso), "time"))).toBeTruthy();
  });
});
