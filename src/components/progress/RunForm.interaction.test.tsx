// @vitest-environment jsdom
// Submits the run form the way a person would and checks what stays on screen.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { logRun } = vi.hoisted(() => ({ logRun: vi.fn() }));
vi.mock("@/app/progress/run/actions", () => ({ logRun }));
import RunForm from "./RunForm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function submit(duration: string) {
  fireEvent.change(screen.getByLabelText("Day"), {
    target: { value: "2026-11-23" },
  });
  fireEvent.change(screen.getByLabelText("Distance (km)"), {
    target: { value: "5.2" },
  });
  fireEvent.change(screen.getByLabelText("Time (h:mm:ss)"), {
    target: { value: duration },
  });
  fireEvent.change(screen.getByLabelText("Effort (1 to 10, optional)"), {
    target: { value: "6" },
  });
  fireEvent.change(screen.getByLabelText("Note (optional)"), {
    target: { value: "Easy loop" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save run" }));
  });
}

describe("RunForm", () => {
  it("formats digits as a time on mobile and desktop", () => {
    render(<RunForm today="2026-11-24" />);
    const time = screen.getByLabelText<HTMLInputElement>("Time (h:mm:ss)");
    expect(time.type).toBe("text");
    expect(time.getAttribute("inputmode")).toBe("numeric");
    fireEvent.change(time, { target: { value: "1" } });
    expect(time.value).toBe("1:");
    fireEvent.change(time, { target: { value: "1:32" } });
    expect(time.value).toBe("1:32:");
    fireEvent.change(time, { target: { value: "1:32:15" } });
    expect(time.value).toBe("1:32:15");
    fireEvent.change(time, { target: { value: "0:32:15" } });
    expect(time.value).toBe("0:32:15");
  });

  it("keeps the first digit as hours when additional digits are typed", () => {
    render(<RunForm today="2026-11-24" />);
    const time = screen.getByLabelText<HTMLInputElement>("Time (h:mm:ss)");
    const values = ["1:", "1:2", "1:23:", "1:23:4", "1:23:45", "1:23:45"];
    for (const [index, digit] of [..."123456"].entries()) {
      fireEvent.input(time, {
        target: { value: time.value + digit },
        inputType: "insertText",
      });
      expect(time.value).toBe(values[index]);
    }
  });

  it("backspaces across an automatically added separator", () => {
    render(<RunForm today="2026-11-24" />);
    const time = screen.getByLabelText<HTMLInputElement>("Time (h:mm:ss)");
    fireEvent.focus(time);
    fireEvent.input(time, { target: { value: "3" }, inputType: "insertText" });
    expect(time.value).toBe("3:");
    time.setSelectionRange(2, 2);
    fireEvent.input(time, {
      target: { value: "3", selectionStart: 1, selectionEnd: 1 },
      inputType: "deleteContentBackward",
    });
    expect(time.value).toBe("");
  });

  it.each(["32:15", "125:00", "1:32:15", "12:05:00"])(
    "preserves the pasted time %s",
    (value) => {
      render(<RunForm today="2026-11-24" />);
      const time = screen.getByLabelText<HTMLInputElement>("Time (h:mm:ss)");
      fireEvent.input(time, {
        target: { value },
        inputType: "insertFromPaste",
      });
      expect(time.value).toBe(value);
    },
  );

  it("keeps the cursor near an edited digit", () => {
    render(<RunForm today="2026-11-24" />);
    const time = screen.getByLabelText<HTMLInputElement>("Time (h:mm:ss)");
    fireEvent.input(time, {
      target: { value: "13215" },
      inputType: "insertText",
    });
    fireEvent.input(time, {
      target: { value: "1:39:15", selectionStart: 4, selectionEnd: 4 },
      inputType: "insertText",
    });
    expect(time.value).toBe("1:39:15");
    expect(time.selectionStart).toBe(4);
  });

  it("submits automatically formatted digits as a clock time", async () => {
    logRun.mockResolvedValue({
      status: "saved",
      date: "2026-11-23",
      distanceKm: 5.2,
      pace: null,
      planDayName: null,
    });
    render(<RunForm today="2026-11-24" />);
    await submit("03112");
    const submitted = logRun.mock.calls[0][1] as FormData;
    expect(submitted.get("duration")).toBe("0:31:12");
  });

  it("keeps what was typed when the server refuses it, and reads the error out", async () => {
    const values = {
      date: "2026-11-23",
      distanceKm: "5.2",
      duration: "31",
      effort: "6",
      note: "Easy loop",
    };
    logRun.mockResolvedValue({
      status: "error",
      message: "Enter the time as h:mm:ss, for example 0:32:15.",
      values,
    });
    render(<RunForm today="2026-11-24" />);
    await submit("31");

    expect(screen.getByRole("alert").textContent).toBe(
      "Enter the time as h:mm:ss, for example 0:32:15.",
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("Time (h:mm:ss)").value,
    ).toBe("31");
    expect(screen.getByLabelText<HTMLInputElement>("Distance (km)").value).toBe(
      "5.2",
    );
    expect(
      screen.getByLabelText<HTMLInputElement>("Note (optional)").value,
    ).toBe("Easy loop");
  });

  it("announces the saved run with its pace and plan day, and clears the form", async () => {
    logRun.mockResolvedValue({
      status: "saved",
      date: "2026-11-23",
      distanceKm: 5.2,
      pace: "6:00 /km",
      planDayName: "Easy run",
    });
    render(<RunForm today="2026-11-24" />);
    await submit("0:31:12");

    expect(screen.getByRole("status").textContent).toBe(
      "Saved your 5.2 km run for Nov 23, 2026 at 6:00 /km. It counts as your plan's Easy run.",
    );
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(
      screen.getByLabelText<HTMLInputElement>("Time (h:mm:ss)").value,
    ).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Day").value).toBe(
      "2026-11-24",
    );
  });
});
