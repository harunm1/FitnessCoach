// @vitest-environment jsdom
// Picking a program (D38): start from a template, or build with the coach, which starts
// from the closest template. Either way the review opens with the adaptation.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { adapt, save } = vi.hoisted(() => ({ adapt: vi.fn(), save: vi.fn() }));
vi.mock("@/app/programs/actions", () => ({
  adaptProgram: adapt,
  saveProgram: save,
}));

import ProgramBuilder from "./ProgramBuilder";

beforeEach(() => {
  vi.clearAllMocks();
  adapt.mockImplementation(async (templateId: string) => ({
    status: "ok",
    adaptation: {
      templateId,
      templateVersion: 1,
      source: "COACH",
      problems: [],
      changes: [],
    },
    names: {},
  }));
});
afterEach(cleanup);

describe("ProgramBuilder", () => {
  it("lists the four templates", () => {
    render(<ProgramBuilder closestId="upper-lower-4" />);
    expect(
      screen.getAllByRole("button", { name: /^start from /i }),
    ).toHaveLength(4);
  });

  it("adapts the picked template and opens its review", async () => {
    render(<ProgramBuilder closestId="upper-lower-4" />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: "Start from Push, pull, legs, 6 days",
        }),
      );
    });
    expect(adapt).toHaveBeenCalledWith("push-pull-legs-6");
    expect(
      screen.getByRole("heading", {
        name: "Changes to Push, pull, legs, 6 days",
      }),
    ).toBeTruthy();
  });

  it("builds with the coach from the closest template", async () => {
    render(<ProgramBuilder closestId="upper-lower-4" />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Build with the coach" }),
      );
    });
    expect(adapt).toHaveBeenCalledWith("upper-lower-4");
  });

  it("says why when the template cannot be adapted", async () => {
    adapt.mockResolvedValue({
      status: "error",
      message: "Take the quiz first.",
    });
    render(<ProgramBuilder closestId={null} />);
    await act(async () => {
      fireEvent.click(
        screen.getAllByRole("button", { name: /^start from /i })[0],
      );
    });
    expect(screen.getByRole("alert").textContent).toBe("Take the quiz first.");
  });

  it("offers Build with the coach only once the quiz is done", () => {
    render(<ProgramBuilder closestId={null} />);
    expect(
      screen.queryByRole("button", { name: "Build with the coach" }),
    ).toBeNull();
  });
});
