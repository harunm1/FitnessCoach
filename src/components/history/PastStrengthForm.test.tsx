// @vitest-environment jsdom
// Fills in the past strength workout form the way a person would and checks what is sent and
// what stays on screen (D49, #194).
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { logPastStrength } = vi.hoisted(() => ({ logPastStrength: vi.fn() }));
vi.mock("@/app/history/log/actions", () => ({ logPastStrength }));
import { PastStrengthForm } from "./PastStrengthForm";

const LIBRARY = [
  { id: "bench-press", name: "Bench Press" },
  { id: "squat", name: "Back Squat" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save workout" }));
  });
}

function sentEntry() {
  const data = logPastStrength.mock.calls[0][1] as FormData;
  return {
    entry: JSON.parse(String(data.get("entry"))),
    unit: data.get("weightUnit"),
  };
}

function fillOneSet(unit = "kg") {
  change("Day", "2026-11-24");
  change("Exercise 1", "bench-press");
  change("Exercise 1, set 1 reps", "8");
  change(`Exercise 1, set 1 weight (${unit})`, "60");
}

describe("PastStrengthForm", () => {
  it("limits the day to today or earlier and starts with one empty set", () => {
    render(
      <PastStrengthForm
        exercises={LIBRARY}
        today="2026-11-26"
        weightUnit="KG"
      />,
    );
    const day = screen.getByLabelText("Day") as HTMLInputElement;
    expect(day.max).toBe("2026-11-26");
    expect(day.value).toBe("2026-11-26");
    expect(screen.getByLabelText("Exercise 1, set 1 reps")).toBeTruthy();
    expect(screen.queryByLabelText("Exercise 1, set 2 reps")).toBeNull();
  });

  it("sends the day, the exercises and the sets as one entry, with the unit shown", async () => {
    logPastStrength.mockResolvedValue({
      status: "saved",
      date: "2026-11-24",
      exercises: 2,
      sets: 3,
    });
    render(
      <PastStrengthForm
        exercises={LIBRARY}
        today="2026-11-26"
        weightUnit="LB"
      />,
    );
    fillOneSet("lb");
    fireEvent.click(
      screen.getByRole("button", { name: "Add set to Exercise 1" }),
    );
    change("Exercise 1, set 2 reps", "6");
    fireEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    change("Exercise 2", "squat");
    change("Exercise 2, set 1 reps", "5");
    change("Minutes (optional)", "50");
    change("Note (optional)", "Felt strong");
    await save();

    expect(sentEntry()).toEqual({
      unit: "LB",
      entry: {
        date: "2026-11-24",
        minutes: "50",
        note: "Felt strong",
        exercises: [
          {
            exerciseId: "bench-press",
            sets: [
              { reps: "8", weight: "60" },
              { reps: "6", weight: "" },
            ],
          },
          { exerciseId: "squat", sets: [{ reps: "5", weight: "" }] },
        ],
      },
    });
  });

  it("says what was saved and links to History", async () => {
    logPastStrength.mockResolvedValue({
      status: "saved",
      date: "2026-11-24",
      exercises: 1,
      sets: 1,
    });
    render(
      <PastStrengthForm
        exercises={LIBRARY}
        today="2026-11-26"
        weightUnit="KG"
      />,
    );
    fillOneSet();
    await save();

    expect(screen.getByRole("status").textContent).toContain(
      "Saved your workout for Nov 24, 2026: 1 exercise, 1 set.",
    );
    expect(
      screen
        .getByRole("link", { name: "See it in History" })
        .getAttribute("href"),
    ).toBe("/history");
    // Ready for the next one, on the same day.
    expect((screen.getByLabelText("Day") as HTMLInputElement).value).toBe(
      "2026-11-24",
    );
    expect(
      (screen.getByLabelText("Exercise 1, set 1 reps") as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("keeps what was typed when the server refuses it, and reads the error out", async () => {
    logPastStrength.mockResolvedValue({
      status: "error",
      message: "That day hasn't happened yet.",
    });
    render(
      <PastStrengthForm
        exercises={LIBRARY}
        today="2026-11-26"
        weightUnit="KG"
      />,
    );
    fillOneSet();
    await save();

    expect(screen.getByRole("alert").textContent).toBe(
      "That day hasn't happened yet.",
    );
    expect(
      (screen.getByLabelText("Exercise 1, set 1 reps") as HTMLInputElement)
        .value,
    ).toBe("8");
    expect(
      (screen.getByLabelText("Exercise 1") as HTMLSelectElement).value,
    ).toBe("bench-press");
  });

  it("removes a set and an exercise but never the last of either", () => {
    render(
      <PastStrengthForm
        exercises={LIBRARY}
        today="2026-11-26"
        weightUnit="KG"
      />,
    );
    expect(screen.queryByRole("button", { name: /^Remove set/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Remove Exercise/ }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Add set to Exercise 1" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Exercise 1, set 2" }),
    );
    expect(screen.queryByLabelText("Exercise 1, set 2 reps")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Exercise 2" }));
    expect(screen.queryByLabelText("Exercise 2")).toBeNull();
  });

  it("stops offering more sets and exercises at the limits", () => {
    render(
      <PastStrengthForm
        exercises={LIBRARY}
        today="2026-11-26"
        weightUnit="KG"
      />,
    );
    const addSet = () =>
      screen.getByRole("button", {
        name: "Add set to Exercise 1",
      }) as HTMLButtonElement;
    Array.from({ length: 9 }).forEach(() => fireEvent.click(addSet()));
    expect(addSet().disabled).toBe(true);
    const addExercise = screen.getByRole("button", {
      name: "Add exercise",
    }) as HTMLButtonElement;
    Array.from({ length: 14 }).forEach(() => fireEvent.click(addExercise));
    expect(addExercise.disabled).toBe(true);
  });
});
