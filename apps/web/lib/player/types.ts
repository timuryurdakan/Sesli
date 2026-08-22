export interface ChordSegment {
  start: number;
  end: number;
  chord: string;
}

export const STEM_NAMES = ["vocals", "drums", "bass", "guitar", "piano", "other"] as const;
export type StemName = (typeof STEM_NAMES)[number];

export interface ChannelState {
  volume: number; // 0..1
  muted: boolean;
  solo: boolean;
}

export type MixerState = Record<StemName, ChannelState>;

export function createDefaultMixerState(): MixerState {
  const state = {} as MixerState;
  for (const name of STEM_NAMES) {
    state[name] = { volume: 1, muted: false, solo: false };
  }
  return state;
}
