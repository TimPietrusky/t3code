/**
 * Speaks reply sentences in order through the session's AudioContext. Each sentence's audio is
 * requested as soon as it is queued and streamed as raw PCM, so playback starts with the first
 * chunk and the next sentence is ready when the current one ends. All speech passes one analyser,
 * which gives the echo detector the exact level being played.
 */
import type { SpeechEngine } from "./engine";
import { voiceLog } from "./voiceLog";

const TTS_SAMPLE_RATE = 24_000;
const FIRST_CHUNK_SAMPLES = 1_200; // 50 ms: start quickly
const CHUNK_SAMPLES = 4_800; // then 200 ms pieces
const SCHEDULE_AHEAD_S = 0.03;

type QueuedSentence = {
  readonly text: string;
  readonly queuedAt: number;
  readonly chunks: Float32Array<ArrayBuffer>[];
  done: boolean;
  failed: boolean;
  wake: (() => void) | null;
};

export class SpeechPlayer {
  private readonly output: AnalyserNode;
  private readonly frame: Float32Array<ArrayBuffer>;
  private queue: QueuedSentence[] = [];
  private sources = new Set<AudioBufferSourceNode>();
  private aborter = new AbortController();
  private running = false;
  /** Bumped by stop(), so an interrupted run ends at its next await. */
  private generation = 0;
  /** When the audio scheduled so far stops being heard (performance time). */
  private endsAt = 0;
  /** The sentence being played, for the log when something cuts it off. */
  private current: string | null = null;
  /** Sentences spoken in the last few seconds, to recognise our own words coming back. */
  // Kept until 15 s after each sentence's audio ends: a long reply is scheduled well ahead of being
  // heard, so its echo comes back long after the sentence was queued (2 Nov: Tim's 120-point reply cut itself off).
  private recent: Array<{ readonly text: string; until: number }> = [];

  constructor(
    private readonly context: AudioContext,
    private readonly onSpeakingChange: (speaking: boolean) => void,
    private readonly onError: (message: string) => void,
    /** Both engines stream the same 16-bit 24 kHz PCM. */
    private readonly engine: () => SpeechEngine,
  ) {
    this.output = context.createAnalyser();
    // Presence's wave reads a 2048-point spectrum (1024 bins) at the analyser's usual smoothing.
    this.output.fftSize = 2048;
    this.output.smoothingTimeConstant = 0.8;
    this.output.connect(context.destination);
    this.frame = new Float32Array(this.output.fftSize);
  }

  /** What is being played, for the bar's wave. */
  get analyser(): AnalyserNode {
    return this.output;
  }

  get speaking(): boolean {
    return this.running;
  }

  /** When the last scheduled audio ends (performance time); its echo is heard a little longer. */
  get audibleUntil(): number {
    return this.endsAt;
  }

  /** RMS of what is being played right now. */
  level(): number {
    this.output.getFloatTimeDomainData(this.frame);
    let sum = 0;
    for (const sample of this.frame) sum += sample * sample;
    return Math.sqrt(sum / this.frame.length);
  }

  recentlySpoken(withinMs = 15_000): ReadonlyArray<string> {
    const since = performance.now() - withinMs;
    this.recent = this.recent.filter((entry) => entry.until >= since);
    return this.recent.map((entry) => entry.text);
  }

  speak(text: string): void {
    const sentence: QueuedSentence = {
      text,
      queuedAt: performance.now(),
      chunks: [],
      done: false,
      failed: false,
      wake: null,
    };
    this.queue.push(sentence);
    void this.stream(sentence, this.aborter.signal);
    if (!this.running) void this.run();
  }

  /** Stops the reply now; `reason` goes to the session log (tap, barge-in, end of call). */
  stop(reason = "stop"): void {
    if (this.running || this.queue.length > 0) {
      voiceLog("voice", "playback.stop", {
        reason,
        cut: this.current,
        dropped: this.queue.slice(1).map((sentence) => sentence.text),
      });
    }
    this.current = null;
    this.endsAt = 0;
    this.generation += 1;
    this.aborter.abort();
    this.aborter = new AbortController();
    for (const sentence of this.queue) sentence.wake?.();
    this.queue = [];
    for (const source of this.sources) source.stop();
    this.sources.clear();
    this.setRunning(false);
  }

  private async stream(sentence: QueuedSentence, signal: AbortSignal): Promise<void> {
    const notify = () => {
      const wake = sentence.wake;
      sentence.wake = null;
      wake?.();
    };
    try {
      const response = await fetch(`/__t3voice/tts?engine=${this.engine()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: sentence.text, format: "pcm" }),
        signal,
      });
      if (!response.ok || response.body === null) {
        const body = (await response.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(
          typeof body.error === "string" ? body.error : `speech failed (${response.status})`,
        );
      }
      const reader = response.body.getReader();
      let pending = new Uint8Array(0);
      let samples: number[] = [];
      const emit = (force: boolean) => {
        const want = sentence.chunks.length === 0 ? FIRST_CHUNK_SAMPLES : CHUNK_SAMPLES;
        if (samples.length === 0 || (!force && samples.length < want)) return;
        sentence.chunks.push(Float32Array.from(samples));
        samples = [];
        notify();
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const bytes = new Uint8Array(pending.length + value.length);
        bytes.set(pending);
        bytes.set(value, pending.length);
        const usable = bytes.length - (bytes.length % 2);
        const view = new DataView(bytes.buffer, 0, usable);
        for (let offset = 0; offset < usable; offset += 2) {
          samples.push(view.getInt16(offset, true) / 0x8000);
        }
        pending = bytes.slice(usable);
        emit(false);
      }
      emit(true);
    } catch (error) {
      sentence.failed = true;
      if (!signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        voiceLog("system", "error", { where: "tts", engine: this.engine(), message });
        this.onError(message);
      }
    } finally {
      sentence.done = true;
      notify();
    }
  }

  private async run(): Promise<void> {
    const generation = this.generation;
    this.setRunning(true);
    let playhead = 0;
    while (this.queue.length > 0) {
      const sentence = this.queue[0]!;
      let played = 0;
      let announced = false;
      let heard: { readonly text: string; until: number } | null = null;
      for (;;) {
        if (played < sentence.chunks.length) {
          if (!announced) {
            heard = { text: sentence.text, until: performance.now() };
            this.recent.push(heard);
            announced = true;
            this.current = sentence.text;
            voiceLog("voice", "say", {
              text: sentence.text,
              engine: this.engine(),
              // From the sentence being queued to its first audio being scheduled.
              waitMs: Math.round(performance.now() - sentence.queuedAt),
            });
          }
          playhead = this.schedule(sentence.chunks[played]!, playhead);
          if (heard !== null) heard.until = this.endsAt;
          played += 1;
          continue;
        }
        if (sentence.done) break;
        await new Promise<void>((resolve) => {
          sentence.wake = resolve;
        });
        if (generation !== this.generation) return;
      }
      this.queue.shift();
    }
    // Let the last scheduled audio finish before reporting silence.
    const remaining = playhead - this.context.currentTime;
    if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining * 1000));
    if (generation !== this.generation) return;
    if (this.queue.length > 0) return void this.run();
    this.current = null;
    this.setRunning(false);
  }

  private schedule(samples: Float32Array<ArrayBuffer>, playhead: number): number {
    const buffer = this.context.createBuffer(1, samples.length, TTS_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    const startAt = Math.max(playhead, this.context.currentTime + SCHEDULE_AHEAD_S);
    source.onended = () => this.sources.delete(source);
    this.sources.add(source);
    source.start(startAt);
    this.endsAt = Math.max(
      this.endsAt,
      performance.now() + (startAt + buffer.duration - this.context.currentTime) * 1000,
    );
    return startAt + buffer.duration;
  }

  private setRunning(running: boolean): void {
    if (this.running === running) return;
    this.running = running;
    this.onSpeakingChange(running);
  }
}
