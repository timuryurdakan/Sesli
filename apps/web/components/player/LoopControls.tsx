"use client";

interface LoopControlsProps {
  loopRegion: { start: number; end: number } | null;
  onClear: () => void;
}

export function LoopControls({ loopRegion, onClear }: LoopControlsProps) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {loopRegion ? (
        <>
          <span>
            Loop: {loopRegion.start.toFixed(1)}s – {loopRegion.end.toFixed(1)}s
          </span>
          <button
            type="button"
            onClick={onClear}
            className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700"
          >
            Loop&apos;u Temizle
          </button>
        </>
      ) : (
        <span className="text-gray-500">Loop oluşturmak için waveform üzerinde sürükleyin</span>
      )}
    </div>
  );
}
