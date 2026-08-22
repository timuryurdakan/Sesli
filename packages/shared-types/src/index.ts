export type JobStatus = "pending" | "processing" | "done" | "failed";

export interface Track {
  id: string;
  userId: string;
  title: string;
  storagePath: string;
  durationSeconds: number | null;
  createdAt: string;
}

/** Bölüm 7 Ajan 9 — Senkronize Prova Modu broadcast payload'ı. */
export interface PracticeSessionState {
  trackId: string;
  position: number;
  isPlaying: boolean;
  currentChordIndex: number;
  hostDeviceId: string;
  updatedAt: number;
}

export interface ChordSegment {
  start: number;
  end: number;
  chord: string;
}

export interface StemPaths {
  vocals: string;
  drums: string;
  bass: string;
  guitar: string;
  piano: string;
  other: string;
}

export interface StemJobInput {
  storagePath: string;
  durationSeconds: number;
}

export interface StemJobOutput {
  stems: StemPaths;
  chords: ChordSegment[];
  bpm: number;
  key: string;
}

export interface StemJob {
  jobId: string;
  userId: string;
  trackId: string;
  status: JobStatus;
  input: StemJobInput;
  output: StemJobOutput | null;
  error: string | null;
}
