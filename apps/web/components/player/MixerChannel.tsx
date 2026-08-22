"use client";

import type { ChannelState, StemName } from "@/lib/player/types";

const STEM_LABELS: Record<StemName, string> = {
  vocals: "Vokal",
  drums: "Davul",
  bass: "Bas",
  guitar: "Gitar",
  piano: "Piyano",
  other: "Diğer",
};

interface MixerChannelProps {
  name: StemName;
  state: ChannelState;
  disabled?: boolean;
  onChange: (state: Partial<ChannelState>) => void;
}

export function MixerChannel({ name, state, disabled, onChange }: MixerChannelProps) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-md border border-gray-200 p-3"
      aria-label={`${STEM_LABELS[name]} kanalı`}
    >
      <span className="text-sm font-medium">{STEM_LABELS[name]}</span>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={state.volume}
        disabled={disabled}
        onChange={(e) => onChange({ volume: Number(e.target.value) })}
        aria-label={`${STEM_LABELS[name]} ses seviyesi`}
        className="h-24 w-6 [writing-mode:vertical-lr] direction-rtl"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
      />

      <div className="flex gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ muted: !state.muted })}
          aria-pressed={state.muted}
          className={`rounded px-2 py-1 text-xs font-semibold ${
            state.muted ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          M
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ solo: !state.solo })}
          aria-pressed={state.solo}
          className={`rounded px-2 py-1 text-xs font-semibold ${
            state.solo ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          S
        </button>
      </div>
    </div>
  );
}
