// The pain stop rule (#92) must hold for sets still in the offline queue (D31): a queued
// set with a stop-range score blocks the exercise on the device, without the server.
import { describe, expect, it } from "vitest";
import { PAIN_TRAFFIC_THRESHOLDS } from "@/lib/coach/painTrafficLight";
import { firstStoppedSet } from "./stoppedSet";

const LOW = 1;
const STOP = PAIN_TRAFFIC_THRESHOLDS.stopMin;
const SET_ONE = 1;
const SET_TWO = 2;

describe("firstStoppedSet", () => {
  it("finds no stop when scores are low or missing", () => {
    expect(
      firstStoppedSet([
        { setNumber: SET_ONE, painDuringSession: LOW, painNextMorning: null },
        { setNumber: SET_TWO, painDuringSession: null, painNextMorning: null },
      ]),
    ).toBeNull();
  });

  it("finds the set whose score reached the stop range", () => {
    expect(
      firstStoppedSet([
        { setNumber: SET_ONE, painDuringSession: LOW, painNextMorning: null },
        { setNumber: SET_TWO, painDuringSession: null, painNextMorning: STOP },
      ]),
    ).toMatchObject({ setNumber: SET_TWO });
  });
});
