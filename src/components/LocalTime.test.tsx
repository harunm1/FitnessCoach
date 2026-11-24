// @vitest-environment jsdom
// Tests for the local time component (#141, #144): the first render is stable for the server,
// then the viewer's own time zone is used.
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    // Pin the browser's zone to one that is not Toronto, so a component stuck on the
    // Toronto text would fail.
    vi.stubEnv("TZ", "Asia/Tokyo");
    render(<LocalTime iso={iso} kind="time" />);
    expect(screen.getByText("7:48 AM")).toBeTruthy();
    vi.unstubAllEnvs();
  });
});

// Live report, 23 Nov 2026: a morning start shown as a UTC afternoon hour. Vercel
// runs in UTC, so a time formatted on the server shows the UTC hour.
describe("LocalTime with a UTC server (the live site)", () => {
  const morning = "2026-11-23T15:55:00.000Z"; // 10:55 AM in Toronto, 3:55 PM in UTC

  it("does not show the UTC hour when the server renders", () => {
    vi.stubEnv("TZ", "UTC");
    const html = renderToStaticMarkup(<LocalTime iso={morning} kind="time" />);
    vi.unstubAllEnvs();
    expect(html).toContain("10:55 AM");
    expect(html).not.toContain("3:55 PM");
  });

  it("shows the browser's own hour once mounted, whatever the server's zone was", () => {
    vi.stubEnv("TZ", "America/Toronto");
    render(<LocalTime iso={morning} kind="time" />);
    expect(screen.getByText("10:55 AM")).toBeTruthy();
    cleanup();
    vi.stubEnv("TZ", "America/Los_Angeles");
    render(<LocalTime iso={morning} kind="time" />);
    expect(screen.getByText("7:55 AM")).toBeTruthy();
    vi.unstubAllEnvs();
  });
});
