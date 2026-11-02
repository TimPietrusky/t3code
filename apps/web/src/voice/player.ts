/**
 * Speaks reply sentences in order through the session's AudioContext, streamed as raw PCM through
 * one analyser (the echo detector's level). A reply ends on the audio clock, never a wall timer:
 * iOS can interrupt the context mid-reply, so it is resumed, cut pieces replay, and every end is
 * logged with its cause.
 */
import type { SpeechEngine } from "./engine";
import { voiceLog } from "./voiceLog";

const TTS_SAMPLE_RATE = 24_000;
const FIRST_CHUNK_SAMPLES = 1_200; // 50 ms: start quickly
const CHUNK_SAMPLES = 4_800; // then 200 ms pieces
const SCHEDULE_AHEAD_S = 0.03;
// A piece that ends this much before its scheduled end was cut short (not by us).
const EARLY_END_S = 0.06;
// Give up on a context that will not run again after this long (then the reply ends, logged).
const STALLED_GIVE_UP_MS = 20_000;
const RESUME_RETRY_MS = 400;

type PlaybackEndCause = "finished" | "barge" | "ctx-interrupted" | "error" | string;

type ScheduledPiece = {
  readonly source: AudioBufferSourceNode;
  readonly samples: Float32Array<ArrayBuffer>;
  readonly startAt: number;
  readonly endAt: number;
};

type QueuedSentence = {
  readonly text: string;
  readonly queuedAt: number;
  started: boolean;
  readonly chunks: Float32Array<ArrayBuffer>[];
  done: boolean;
  failed: boolean;
  wake: (() => void) | null;
};

export class SpeechPlayer {
  private readonly output: AnalyserNode;
  private readonly frame: Float32Array<ArrayBuffer>;
  private queue: QueuedSentence[] = [];
  private pieces = new Set<ScheduledPiece>();
  /** Where the next piece starts on the context's clock. */
  private playhead = 0;
  /** Wakes the run's wait for the last piece to end. */
  private settled: (() => void) | null = null;
  /** The context stopped running mid-reply (performance time), null while it runs. */
  private stalledSince: number | null = null;
  private resumeTimer: number | null = null;
  /** Sentences whose speech failed in this run (the end is logged as "error"). */
  private failedInRun = 0;
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
    context.addEventListener("statechange", this.onContextState);
  }

  /** Stops watching the context (the call ended). */
  dispose(): void {
    this.context.removeEventListener("statechange", this.onContextState);
    if (this.resumeTimer !== null) window.clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
  }

  private readonly onContextState = (): void => {
    const state = this.context.state as string;
    voiceLog("voice", "audio.context", {
      state,
      speaking: this.running,
      clock: Math.round(this.context.currentTime * 1000) / 1000,
      visibility: document.visibilityState,
    });
    if (state === "running") {
      if (this.stalledSince !== null) {
        voiceLog("voice", "playback.resumed", {
          afterMs: Math.round(performance.now() - this.stalledSince),
          current: this.current,
        });
      }
      this.stalledSince = null;
      // Anything cut short while the context was down plays again from where it stopped.
      this.recover("resumed");
      return;
    }
    if (state === "closed" || !this.running) return;
    // "interrupted" (iOS: a call, Siri, an audio route change) or "suspended": keep the reply, get
    // the context going again.
    this.stalledSince ??= performance.now();
    this.resumeContext();
  };

  /** Asks the context to run again until it does (iOS resumes once its interruption ends). */
  resumeContext(): void {
    if (this.resumeTimer !== null) return;
    const attempt = () => {
      this.resumeTimer = null;
      const state = this.context.state as string;
      if (state === "running" || state === "closed" || !this.running) return;
      this.context.resume().catch(() => {});
      this.resumeTimer = window.setTimeout(attempt, RESUME_RETRY_MS);
    };
    attempt();
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
      started: false,
      chunks: [],
      done: false,
      failed: false,
      wake: null,
    };
    this.queue.push(sentence);
    void this.stream(sentence, this.aborter.signal);
    if (!this.running) void this.run();
  }

  /** Removes a queued sentence that has not started playing; true when one was dropped. */
  drop(text: string): boolean {
    const sentence = this.queue.find((entry) => entry.text === text && !entry.started);
    if (sentence === undefined) return false;
    this.queue = this.queue.filter((entry) => entry !== sentence);
    voiceLog("voice", "say.dropped", { text });
    sentence.wake?.();
    return true;
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
    const wasRunning = this.running;
    const cut = this.current;
    this.current = null;
    this.endsAt = 0;
    this.generation += 1;
    this.aborter.abort();
    this.aborter = new AbortController();
    for (const sentence of this.queue) sentence.wake?.();
    this.queue = [];
    this.silence();
    if (wasRunning) {
      this.logEnd(reason.startsWith("barge") ? "barge" : reason, { reason, cut });
    }
    this.setRunning(false);
  }

  /** Stops and forgets every scheduled piece (ours, so their `ended` is not an early end). */
  private silence(): void {
    for (const piece of this.pieces) {
      piece.source.onended = null;
      try {
        piece.source.stop();
      } catch {
        // Never started (context suspended): nothing to stop.
      }
    }
    this.pieces.clear();
    this.playhead = 0;
    this.wakeSettled();
  }

  private wakeSettled(): void {
    const settled = this.settled;
    this.settled = null;
    settled?.();
  }

  private logEnd(cause: PlaybackEndCause, data: Record<string, unknown> = {}): void {
    voiceLog("voice", "playback.end", {
      cause,
      context: this.context.state,
      failed: this.failedInRun,
      ...data,
    });
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
    if (!this.running) this.failedInRun = 0;
    this.setRunning(true);
    if ((this.context.state as string) !== "running") {
      this.stalledSince ??= performance.now();
      this.resumeContext();
    }
    while (this.queue.length > 0) {
      const sentence = this.queue[0]!;
      let played = 0;
      let announced = false;
      let heard: { readonly text: string; until: number } | null = null;
      for (;;) {
        if (played < sentence.chunks.length) {
          if (!announced) {
            sentence.started = true;
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
          this.schedule(sentence.chunks[played]!);
          if (heard !== null) heard.until = this.endsAt;
          played += 1;
          continue;
        }
        if (sentence.done) {
          if (sentence.failed) this.failedInRun += 1;
          break;
        }
        await new Promise<void>((resolve) => {
          sentence.wake = resolve;
        });
        if (generation !== this.generation) return;
        // Dropped before it started (drop()): go on with the next one.
        if (!this.queue.includes(sentence)) break;
      }
      if (this.queue[0] === sentence) this.queue.shift();
    }
    // The reply ends when its audio has really played: on the context's clock, not a wall timer.
    const cause = await this.played(generation);
    if (generation !== this.generation) return;
    if (this.queue.length > 0) return void this.run();
    this.logEnd(cause === "finished" && this.failedInRun > 0 ? "error" : cause, {
      last: this.current,
    });
    this.current = null;
    this.setRunning(false);
  }

  /** Waits until every scheduled piece has played; "ctx-interrupted" if the context never came back. */
  private async played(generation: number): Promise<PlaybackEndCause> {
    for (;;) {
      if (generation !== this.generation) return "stopped";
      const running = (this.context.state as string) === "running";
      if (running && this.context.currentTime >= this.playhead - 0.005) {
        // Some WebKit builds drop `ended` for pieces that finished: the clock is the truth.
        this.pieces.clear();
        return "finished";
      }
      if (!running && this.stalledSince !== null) {
        if (performance.now() - this.stalledSince > STALLED_GIVE_UP_MS) {
          this.silence();
          return "ctx-interrupted";
        }
      }
      await new Promise<void>((resolve) => {
        this.settled = resolve;
        const left = running ? (this.playhead - this.context.currentTime) * 1000 : 250;
        window.setTimeout(resolve, Math.min(250, Math.max(20, left)));
      });
      this.settled = null;
    }
  }

  /**
   * Puts back whatever an interruption cut short: every piece not yet fully played is stopped and
   * scheduled again from where it stopped, in order, from now.
   */
  private recover(why: string): void {
    if ((this.context.state as string) !== "running" || this.pieces.size === 0) return;
    const now = this.context.currentTime;
    const cut = [...this.pieces].filter((piece) => piece.source.onended === null);
    if (cut.length === 0) return;
    const pending = [...this.pieces].sort((a, b) => a.startAt - b.startAt);
    for (const piece of pending) {
      piece.source.onended = null;
      try {
        piece.source.stop();
      } catch {
        // Not started yet.
      }
    }
    this.pieces.clear();
    this.playhead = 0;
    let replayedS = 0;
    for (const piece of pending) {
      const playedS = Math.max(0, now - piece.startAt);
      const from = Math.min(piece.samples.length, Math.floor(playedS * TTS_SAMPLE_RATE));
      if (piece.samples.length - from < 240) continue;
      const rest = piece.samples.slice(from);
      replayedS += rest.length / TTS_SAMPLE_RATE;
      this.schedule(rest);
    }
    voiceLog("voice", "playback.replayed", {
      why,
      pieces: pending.length,
      seconds: Math.round(replayedS * 100) / 100,
      current: this.current,
    });
  }

  private schedule(samples: Float32Array<ArrayBuffer>): void {
    const buffer = this.context.createBuffer(1, samples.length, TTS_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    const startAt = Math.max(this.playhead, this.context.currentTime + SCHEDULE_AHEAD_S);
    const piece: ScheduledPiece = {
      source,
      samples,
      startAt,
      endAt: startAt + buffer.duration,
    };
    const generation = this.generation;
    source.onended = () => this.onPieceEnded(piece, generation);
    this.pieces.add(piece);
    source.start(startAt);
    this.playhead = piece.endAt;
    this.endsAt = Math.max(
      this.endsAt,
      performance.now() + (piece.endAt - this.context.currentTime) * 1000,
    );
  }

  private onPieceEnded(piece: ScheduledPiece, generation: number): void {
    if (generation !== this.generation || !this.pieces.has(piece)) return;
    const now = this.context.currentTime;
    if (now < piece.endAt - EARLY_END_S) {
      // Cut short by the platform, not by us: mark it and play the rest again once the context runs.
      piece.source.onended = null;
      voiceLog("voice", "playback.cut-short", {
        context: this.context.state,
        missingS: Math.round((piece.endAt - now) * 100) / 100,
        current: this.current,
        visibility: document.visibilityState,
      });
      if ((this.context.state as string) === "running") this.recover("cut short");
      else {
        this.stalledSince ??= performance.now();
        this.resumeContext();
      }
      return;
    }
    this.pieces.delete(piece);
    if (this.pieces.size === 0) this.wakeSettled();
  }

  private setRunning(running: boolean): void {
    if (this.running === running) return;
    this.running = running;
    this.onSpeakingChange(running);
  }
}
