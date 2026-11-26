// @vitest-environment jsdom
// The exercise card (D44): a set table that hands each set to the offline queue, shows last
// time's set, starts pre-filled from the plan, and follows the pain check-in's stop rule.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("@/lib/offline/sessionSetQueue", () => ({
  sessionSetQueue: { enqueue },
  useSessionSetQueue: () => ({
    items: [],
    online: true,
    syncing: false,
    justSynced: false,
    failure: null,
  }),
}));
vi.mock("@/app/account/unit-actions", () => ({ setWeightUnit: vi.fn() }));
vi.mock("@/lib/alerts/browserAlert", () => ({
  unlockAudio: vi.fn(),
  alertRestEnded: vi.fn(),
}));
import ExerciseCard from "./ExerciseCard";

const base = {
  workoutId: 7,
  exerciseId: "bench",
  exerciseName: "Bench press",
  equipment: "barbell",
  primaryMuscle: "chest",
  plannedSets: 3,
  targetReps: 8,
  restSeconds: 90,
  serverSets: [],
  previous: [{ setNumber: 1, reps: 10, weightKg: "60" }],
  lastLoggedAtIso: null,
  serverNowIso: "2026-11-26T15:00:00.000Z",
  weightUnit: "KG" as const,
  suggestedWeightKg: 62.5,
};

beforeEach(() => {
  enqueue.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
});
afterEach(cleanup);

describe("ExerciseCard", () => {
  it("shows a row per planned set with last time's set and plan-filled boxes", () => {
    render(<ExerciseCard {...base} />);
    const table = screen.getByRole("table", { name: "Bench press sets" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("60 kg × 10")).toBeTruthy();
    expect(screen.getByLabelText("Reps for set 1")).toHaveProperty(
      "value",
      "8",
    );
    // Set 1 starts at last time's weight; the others at the weight lifted lately.
    expect(screen.getByLabelText("Weight (kg) for set 1")).toHaveProperty(
      "value",
      "60",
    );
    expect(screen.getByLabelText("Weight (kg) for set 2")).toHaveProperty(
      "value",
      "62.5",
    );
  });

  it("only lets the next set be checked, and queues it with the typed values", async () => {
    render(<ExerciseCard {...base} />);
    expect(screen.getByRole("button", { name: "Log set 2" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.change(screen.getByLabelText("Reps for set 1"), {
      target: { value: "9" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Log set 1" }));
    });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toMatchObject({
      workoutId: 7,
      exerciseId: "bench",
      setNumber: 1,
      reps: 9,
      weightKg: "60",
      painDuringSession: null,
      painNextMorning: null,
    });
  });

  it("starts a body-only exercise with an empty weight box for added load", () => {
    render(<ExerciseCard {...base} equipment="body only" />);
    expect(screen.getByLabelText("Weight (kg) for set 1")).toHaveProperty(
      "value",
      "",
    );
    expect(screen.getByLabelText("Reps for set 1")).toBeTruthy();
  });

  it("adds a set up to six and removes only rows that are not logged", () => {
    render(<ExerciseCard {...base} />);
    const add = screen.getByRole("button", { name: "Add set" });
    [1, 2, 3].forEach(() => fireEvent.click(add));
    expect(screen.getAllByRole("row")).toHaveLength(7);
    expect(add).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Remove set" }));
    expect(screen.getAllByRole("row")).toHaveLength(6);
  });

  it("shows logged sets as rows with the weight in the user's unit", () => {
    render(
      <ExerciseCard
        {...base}
        serverSets={[
          {
            id: 1,
            setNumber: 1,
            reps: 8,
            weightKg: "60",
            painDuringSession: null,
            painNextMorning: null,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("row", { name: "Set 1: 8 reps · 60 kg" }),
    ).toBeTruthy();
    expect(screen.getByText("Set 1 logged")).toBeTruthy();
  });

  it("sends the check-in with each set and blocks logging at a stop-range score", async () => {
    window.localStorage.setItem("fc.checkin.7", "3");
    const view = render(<ExerciseCard {...base} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Log set 1" }));
    });
    expect(enqueue.mock.calls[0][0]).toMatchObject({ painNextMorning: 3 });
    cleanup();
    window.localStorage.setItem("fc.checkin.7", "7");
    render(<ExerciseCard {...base} />);
    expect(view).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("stop range");
    expect(screen.getByRole("button", { name: "Log set 1" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("keeps the rest choice per exercise and offers Off", () => {
    render(<ExerciseCard {...base} />);
    const select = screen.getByLabelText("Rest timer");
    expect(select).toHaveProperty("value", "90");
    fireEvent.change(select, { target: { value: "0" } });
    expect(window.localStorage.getItem("fc.rest.bench")).toBe("0");
  });
});
