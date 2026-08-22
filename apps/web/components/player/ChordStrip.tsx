"use client";

import type { ChordSegment } from "@/lib/player/types";

interface ChordStripProps {
  chords: ChordSegment[];
  currentTime: number;
}

export function ChordStrip({ chords, currentTime }: ChordStripProps) {
  if (chords.length === 0) {
    return <p className="text-sm text-gray-500">Akor verisi yok.</p>;
  }

  const activeIndex = chords.findIndex((c) => currentTime >= c.start && currentTime < c.end);
  const upcoming = chords.slice(Math.max(activeIndex, 0), Math.max(activeIndex, 0) + 6);

  return (
    <div
      className="flex items-center gap-3 overflow-x-auto rounded-md bg-gray-50 p-3"
      aria-live="polite"
    >
      {upcoming.map((segment, i) => {
        const isActive = activeIndex >= 0 && chords[activeIndex] === segment;
        return (
          <span
            key={`${segment.start}-${i}`}
            className={`shrink-0 rounded-md px-4 py-2 text-lg font-bold ${
              isActive ? "bg-indigo-600 text-white" : "bg-white text-gray-500"
            }`}
          >
            {segment.chord}
          </span>
        );
      })}
    </div>
  );
}
