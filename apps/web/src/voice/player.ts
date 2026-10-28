/**
 * Speaks reply sentences in order through the session's AudioContext. Each sentence's audio is
 * requested as soon as it is queued and streamed as raw PCM, so playback starts with the first
 * chunk and the next sentence is ready when the current one ends. All speech passes one analyser,
 * which gives the echo detector the exact level being played.
 */
const TTS_SAMPLE_RATE = 24_000;
const FIRST_CHUNK_SAMPLES = 1_200; // 50 ms: start quickly
const CHUNK_SAMPLES = 4_800; // then 200 ms pieces
const SCHEDULE_AHEAD_S = 0.03;

type QueuedSentence = {
  readonly text: string;
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
  /** Sentences spoken in the last few seconds, to recognise our own words coming back. */
  private recent: Array<{ readonly text: string; readonly at: number }> = [];

  constructor(
    private readonly context: AudioContext,
    private readonly onSpeakingChange: (speaking: boolean) => void,
    private readonly onError: (message: string) => void,
  ) {
    this.output = context.createAnalyser();
    this.output.fftSize = 512;
    this.output.connect(context.destination);
    this.frame = new Float32Array(this.output.fftSize);
  }

  get speaking(): boolean {
    return this.running;
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
    this.recent = this.recent.filter((entry) => entry.at >= since);
    return this.recent.map((entry) => entry.text);
  }

  speak(text: string): void {
    const sentence: QueuedSentence = { text, chunks: [], done: false, failed: false, wake: null };
    this.queue.push(sentence);
    void this.stream(sentence, this.aborter.signal);
    if (!this.running) void this.run();
  }

  stop(): void {
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
      const response = await fetch("/__t3voice/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: sentence.text, format: "pcm" }),
        signal,
      });
      if (!response.ok || response.body === null) {
        throw new Error(`speech failed (${response.status})`);
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
      if (!signal.aborted) this.onError(error instanceof Error ? error.message : String(error));
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
      for (;;) {
        if (played < sentence.chunks.length) {
          if (!announced) {
            this.recent.push({ text: sentence.text, at: performance.now() });
            announced = true;
          }
          playhead = this.schedule(sentence.chunks[played]!, playhead);
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
    return startAt + buffer.duration;
  }

  private setRunning(running: boolean): void {
    if (this.running === running) return;
    this.running = running;
    this.onSpeakingChange(running);
  }
}
