/**
 * Hands-free speech for t3 voice: one open microphone, an energy-based voice detector, utterances
 * transcribed through the dev server's `/__t3voice/stt`, and replies spoken through
 * `/__t3voice/tts`. Speaking over a reply stops it (barge-in). Audio never leaves the browser except
 * to the dev server, and nothing is kept after transcription.
 */
export type VoicePhase = "off" | "listening" | "hearing" | "transcribing" | "speaking";

export type VoiceSessionEvents = {
  readonly onPhase: (phase: VoicePhase) => void;
  readonly onUtterance: (text: string) => void;
  readonly onError: (message: string) => void;
};

const FRAME_MS = 30;
const SPEECH_START_MS = 150;
const BARGE_IN_MS = 300;
const SPEECH_END_MS = 850;
const MIN_SPEECH_MS = 350;
const RECYCLE_IDLE_MS = 20_000;
const MIN_LEVEL = 0.012;
const MIN_BARGE_IN_LEVEL = 0.035;

/** Replies are written for the ear, but strip any markdown that slips through before speaking. */
export function speakableText(text: string): string {
  const spoken = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return /\p{L}/u.test(spoken) ? spoken.slice(0, 700) : "";
}

export class VoiceSession {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frame: Float32Array<ArrayBuffer> | null = null;
  private timer: number | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recorderStartedAt = 0;
  private noiseFloor = MIN_LEVEL / 3;
  private loudMs = 0;
  private quietMs = 0;
  private speechMs = 0;
  private inSpeech = false;
  private bargedIn = false;
  private queue: string[] = [];
  private audio: HTMLAudioElement | null = null;
  private speaking = false;
  private pendingTranscriptions = 0;
  private phase: VoicePhase = "off";

  constructor(private readonly events: VoiceSessionEvents) {}

  async start(): Promise<void> {
    if (this.stream !== null) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.context = new AudioContext();
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
    this.frame = new Float32Array(this.analyser.fftSize);
    this.startRecorder();
    this.timer = window.setInterval(() => this.tick(), FRAME_MS);
    this.updatePhase();
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stopSpeaking();
    this.discardRecorder();
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    void this.context?.close();
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.inSpeech = false;
    this.setPhase("off");
  }

  get active(): boolean {
    return this.stream !== null;
  }

  speak(text: string): void {
    const spoken = speakableText(text);
    if (spoken === "" || this.stream === null) return;
    this.queue.push(spoken);
    if (!this.speaking) void this.playNext();
  }

  stopSpeaking(): void {
    this.queue = [];
    this.speaking = false;
    if (this.audio !== null) {
      this.audio.pause();
      URL.revokeObjectURL(this.audio.src);
      this.audio = null;
    }
    this.updatePhase();
  }

  private async playNext(): Promise<void> {
    const text = this.queue.shift();
    if (text === undefined) {
      this.speaking = false;
      // Whatever the mic caught while we talked is mostly our own echo.
      if (!this.inSpeech) this.restartRecorder();
      this.updatePhase();
      return;
    }
    this.speaking = true;
    this.bargedIn = false;
    this.updatePhase();
    try {
      const response = await fetch("/__t3voice/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error(`speech failed (${response.status})`);
      const blob = await response.blob();
      if (!this.speaking) return;
      if (!this.inSpeech) this.restartRecorder();
      const audio = new Audio(URL.createObjectURL(blob));
      this.audio = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.onpause = () => resolve();
        void audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(audio.src);
      if (this.audio === audio) this.audio = null;
    } catch (error) {
      this.events.onError(error instanceof Error ? error.message : String(error));
    }
    if (this.speaking) void this.playNext();
  }

  private tick(): void {
    if (this.analyser === null || this.frame === null) return;
    this.analyser.getFloatTimeDomainData(this.frame);
    let sum = 0;
    for (const sample of this.frame) sum += sample * sample;
    const level = Math.sqrt(sum / this.frame.length);

    const threshold = this.speaking
      ? Math.max(MIN_BARGE_IN_LEVEL, this.noiseFloor * 6)
      : Math.max(MIN_LEVEL, this.noiseFloor * 3);
    const loud = level > threshold;
    if (!loud && !this.inSpeech) {
      this.noiseFloor = this.noiseFloor * 0.95 + level * 0.05;
    }

    if (loud) {
      this.loudMs += FRAME_MS;
      this.quietMs = 0;
    } else {
      this.loudMs = 0;
      this.quietMs += FRAME_MS;
    }

    if (!this.inSpeech) {
      if (this.speaking && this.loudMs >= BARGE_IN_MS) {
        // Tim talks over the reply: stop it and treat this as a new utterance.
        this.bargedIn = true;
        this.stopSpeaking();
        this.beginSpeech();
      } else if (!this.speaking && this.loudMs >= SPEECH_START_MS) {
        this.beginSpeech();
      } else if (!this.speaking && performance.now() - this.recorderStartedAt > RECYCLE_IDLE_MS) {
        this.restartRecorder();
      }
      return;
    }

    this.speechMs += FRAME_MS;
    if (this.quietMs >= SPEECH_END_MS) {
      const spokeLongEnough = this.speechMs - this.quietMs >= MIN_SPEECH_MS;
      this.inSpeech = false;
      this.speechMs = 0;
      if (spokeLongEnough) this.finishUtterance();
      else this.restartRecorder();
      this.updatePhase();
    }
  }

  private beginSpeech(): void {
    this.inSpeech = true;
    this.speechMs = this.loudMs;
    this.updatePhase();
  }

  private finishUtterance(): void {
    const recorder = this.recorder;
    if (recorder === null) return;
    const chunks = this.chunks;
    this.recorder = null;
    this.chunks = [];
    this.pendingTranscriptions += 1;
    this.updatePhase();
    recorder.onstop = () => {
      const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      void this.transcribe(audio);
    };
    recorder.stop();
    this.startRecorder();
  }

  private async transcribe(audio: Blob): Promise<void> {
    try {
      const response = await fetch("/__t3voice/stt", {
        method: "POST",
        headers: { "content-type": audio.type },
        body: audio,
      });
      const body = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? `transcription failed (${response.status})`);
      const text = body.text?.trim() ?? "";
      if (/\p{L}/u.test(text) && this.stream !== null) this.events.onUtterance(text);
    } catch (error) {
      this.events.onError(error instanceof Error ? error.message : String(error));
    } finally {
      this.pendingTranscriptions -= 1;
      this.updatePhase();
    }
  }

  private startRecorder(): void {
    if (this.stream === null) return;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";
    const recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    recorder.start(250);
    this.recorder = recorder;
    this.recorderStartedAt = performance.now();
  }

  private discardRecorder(): void {
    const recorder = this.recorder;
    this.recorder = null;
    this.chunks = [];
    if (recorder !== null && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.stop();
    }
  }

  private restartRecorder(): void {
    if (this.bargedIn && this.inSpeech) return;
    this.discardRecorder();
    this.startRecorder();
  }

  private updatePhase(): void {
    if (this.stream === null) return this.setPhase("off");
    if (this.inSpeech) return this.setPhase("hearing");
    if (this.speaking) return this.setPhase("speaking");
    if (this.pendingTranscriptions > 0) return this.setPhase("transcribing");
    this.setPhase("listening");
  }

  private setPhase(phase: VoicePhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.events.onPhase(phase);
  }
}
