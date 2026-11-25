// @vitest-environment jsdom
// The set form hands each set to the offline queue (D31) instead of posting it, so a lost
// connection cannot lose it. One set attempt keeps one clientId, so a double tap is one set.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SetLogForm, { type LoggedSetInput } from "./SetLogForm";

const TARGET_REPS = 10;
const SET_ONE = 1;
const SET_TWO = 2;
const REPS = 8;
const UUID_LENGTH = 36;
const UUID_VERSION_INDEX = 14;

afterEach(cleanup);

function renderForm(nextSetNumber: number, onLog = vi.fn()) {
  const view = render(
    <SetLogForm
      exerciseId="press"
      nextSetNumber={nextSetNumber}
      targetReps={TARGET_REPS}
      onLog={onLog}
    />,
  );
  return { ...view, onLog };
}

// Clicks Log set and lets the form finish storing the set.
async function submit(reps: string, weight: string, setNumber = SET_ONE) {
  fireEvent.change(screen.getByLabelText("REPS"), {
    target: { value: reps },
  });
  fireEvent.change(screen.getByLabelText("KG"), { target: { value: weight } });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: `Log set ${setNumber}` }),
    );
  });
}

describe("SetLogForm with the offline queue", () => {
  it("hands the set to the queue with a new clientId", async () => {
    const { onLog } = renderForm(SET_ONE);
    await submit("8", "12.5");
    expect(onLog).toHaveBeenCalledTimes(1);
    const set: LoggedSetInput = onLog.mock.calls[0][0];
    expect(set).toMatchObject({
      setNumber: SET_ONE,
      reps: REPS,
      weightKg: "12.5",
    });
    // crypto.randomUUID() gives a version 4 UUID: 36 characters, "4" after the second dash.
    expect(set.clientId).toHaveLength(UUID_LENGTH);
    expect(set.clientId[UUID_VERSION_INDEX]).toBe("4");
  });

  it("sends an empty weight as no weight", async () => {
    const { onLog } = renderForm(SET_ONE);
    await submit("8", "");
    expect(onLog.mock.calls[0][0].weightKg).toBeNull();
  });

  it("logs a double tap once: the button waits while the set is stored", async () => {
    const { onLog } = renderForm(
      SET_ONE,
      vi.fn(() => new Promise<void>(() => {})),
    );
    await submit("8", "12");
    expect(
      screen
        .getByRole("button", { name: "Saving..." })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Saving..." }));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it("makes a new clientId for the next set", async () => {
    const { onLog, rerender } = renderForm(SET_ONE);
    await submit("8", "12");
    rerender(
      <SetLogForm
        exerciseId="press"
        nextSetNumber={SET_TWO}
        targetReps={TARGET_REPS}
        onLog={onLog}
      />,
    );
    await submit("8", "12", SET_TWO);
    expect(onLog.mock.calls[1][0]).toMatchObject({ setNumber: SET_TWO });
    expect(onLog.mock.calls[1][0].clientId).not.toBe(
      onLog.mock.calls[0][0].clientId,
    );
  });

  it("refuses invalid values on the device instead of queueing them", async () => {
    const { onLog, container } = renderForm(SET_ONE);
    fireEvent.change(screen.getByLabelText("REPS"), { target: { value: "0" } });
    // Submit the form itself: the browser's own min check would stop a click first, and
    // this checks the guard behind it.
    const form = container.querySelector("form");
    if (!form) throw new Error("form not rendered");
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(onLog).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent?.trim()).not.toBe("");
  });
});
