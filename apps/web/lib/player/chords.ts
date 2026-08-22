import type { ChordSegment } from "./types";

export function currentChordIndexFor(chords: ChordSegment[], time: number): number {
  return chords.findIndex((c) => time >= c.start && time < c.end);
}
