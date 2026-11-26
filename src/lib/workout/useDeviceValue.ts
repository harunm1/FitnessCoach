"use client";

// A small value kept in this browser's localStorage and shared by every component of the
// page that reads the same key (D44): today's pain check-in, an exercise's notes and its
// rest choice. Device-only on purpose: none of these is part of the saved workout.
import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "fc:device-value";

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useDeviceValue(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => "",
  );
  const set = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Storage blocked: the value lasts only until the page is left.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );
  return [value, set];
}

export const checkInKey = (workoutId: number) => `fc.checkin.${workoutId}`;
export const notesKey = (workoutId: number, exerciseId: string) =>
  `fc.notes.${workoutId}.${exerciseId}`;
export const restKey = (exerciseId: string) => `fc.rest.${exerciseId}`;
