const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

/**
 * Web Audio look-ahead scheduler tabanlı metronom (Özellik 3/6: senkronize
 * metronom + geri sayım). Klasik "A Tale of Two Clocks" tekniği (Chris
 * Wilson) — `setInterval` yalnızca bir sonraki tık'ları zamanlamak için
 * kullanılır, gerçek ses zamanlaması `AudioContext.currentTime`'a göre
 * `AudioContext` üzerinden yapılır (sample-accurate).
 */
export class Metronome {
  private audioContext: AudioContext;
  private bpm: number;
  private accentEveryBeats: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private beatCount = 0;

  constructor(bpm: number, accentEveryBeats = 4) {
    this.audioContext = new AudioContext();
    this.bpm = bpm;
    this.accentEveryBeats = accentEveryBeats;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  start(): void {
    if (this.timerId) return;
    this.beatCount = 0;
    this.nextNoteTime = this.audioContext.currentTime;
    this.timerId = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * `beats` tık çalıp (varsayılan 4 — Özellik 6: özelleştirilebilir geri
   * sayım) tamamlandığında `onComplete`'i çağırır.
   */
  countIn(beats: number, onComplete: () => void): void {
    const secondsPerBeat = 60 / this.bpm;
    let startTime = this.audioContext.currentTime + 0.1;

    for (let i = 0; i < beats; i++) {
      this.playClick(startTime, i === 0);
      startTime += secondsPerBeat;
    }

    setTimeout(onComplete, (beats * secondsPerBeat + 0.1) * 1000);
  }

  private scheduler(): void {
    const secondsPerBeat = 60 / this.bpm;
    while (this.nextNoteTime < this.audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
      const isAccent = this.beatCount % this.accentEveryBeats === 0;
      this.playClick(this.nextNoteTime, isAccent);
      this.nextNoteTime += secondsPerBeat;
      this.beatCount++;
    }
  }

  private playClick(time: number, accent: boolean): void {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  destroy(): void {
    this.stop();
    void this.audioContext.close();
  }
}
