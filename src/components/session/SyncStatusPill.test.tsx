// @vitest-environment jsdom
// The small sync status in the session view (D31): offline, sets waiting, syncing, synced,
// and a failed sync with Try again and Discard. Read by screen readers through live regions.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SyncStatusPill, { type SyncStatusPillProps } from "./SyncStatusPill";

const TWO = 2;

const base: SyncStatusPillProps = {
  online: true,
  pending: 0,
  syncing: false,
  justSynced: false,
  failure: null,
  onRetry: () => {},
  onDiscard: () => {},
};

afterEach(cleanup);

describe("SyncStatusPill", () => {
  it("shows nothing when online with nothing to sync", () => {
    render(<SyncStatusPill {...base} />);
    // The live region stays mounted and empty, so later messages are announced.
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says sets are saved offline and how many wait", () => {
    render(<SyncStatusPill {...base} online={false} pending={TWO} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Offline");
    expect(status.textContent).toContain("Saved offline, 2 to sync");
  });

  it("says sets will be kept on the device when offline with none waiting", () => {
    render(<SyncStatusPill {...base} online={false} />);
    expect(screen.getByRole("status").textContent).toContain(
      "Offline. Sets you log are kept on this device.",
    );
  });

  it("shows syncing while the queue is sent", () => {
    render(<SyncStatusPill {...base} pending={TWO} syncing />);
    expect(screen.getByRole("status").textContent).toContain("Syncing 2 sets");
  });

  it("confirms when every set is synced", () => {
    render(<SyncStatusPill {...base} justSynced />);
    expect(screen.getByRole("status").textContent).toContain("All sets synced");
  });

  it("says a set could not reach the server and offers Try again, not Discard", () => {
    const onRetry = vi.fn();
    render(
      <SyncStatusPill
        {...base}
        pending={1}
        failure={{ kind: "network", message: "Failed to fetch" }}
        onRetry={onRetry}
      />,
    );
    const status = screen.getByRole("status").textContent;
    expect(status).toContain("Saved offline, 1 to sync");
    expect(status).toContain("Could not reach the server; it will try again.");
    expect(
      screen.queryByRole("button", { name: "Discard this set" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("announces a failed sync and offers Try again and Discard as buttons", () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    render(
      <SyncStatusPill
        {...base}
        pending={1}
        failure={{ kind: "rejected", message: "That set is out of date." }}
        onRetry={onRetry}
        onDiscard={onDiscard}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Could not sync a set: That set is out of date.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard this set" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
