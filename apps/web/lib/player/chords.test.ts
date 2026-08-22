import { describe, expect, it } from "vitest";
import { currentChordIndexFor } from "./chords";
import type { ChordSegment } from "./types";

const CHORDS: ChordSegment[] = [
  { start: 0, end: 2, chord: "Am" },
  { start: 2, end: 4, chord: "F" },
  { start: 4, end: 6, chord: "C" },
];

describe("currentChordIndexFor", () => {
  it("returns the segment containing the given time", () => {
    expect(currentChordIndexFor(CHORDS, 0)).toBe(0);
    expect(currentChordIndexFor(CHORDS, 1.9)).toBe(0);
    expect(currentChordIndexFor(CHORDS, 2)).toBe(1);
    expect(currentChordIndexFor(CHORDS, 5.5)).toBe(2);
  });

  it("returns -1 when time is outside all segments", () => {
    expect(currentChordIndexFor(CHORDS, -1)).toBe(-1);
    expect(currentChordIndexFor(CHORDS, 6)).toBe(-1);
    expect(currentChordIndexFor(CHORDS, 100)).toBe(-1);
  });

  it("returns -1 for an empty chord list", () => {
    expect(currentChordIndexFor([], 0)).toBe(-1);
  });
});
