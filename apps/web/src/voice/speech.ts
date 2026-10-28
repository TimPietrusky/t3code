/**
 * Hands-free speech for t3 voice: open mic, energy voice detection, realtime speech-to-text, and
 * replies spoken sentence by sentence. Barge-in only fires when the mic is clearly louder than the
 * echo of what is playing, and transcripts of our own words are dropped (laptop speakers).
 */
import { SpeechPlayer } from "./player";
import { RealtimeStt, STT_SAMPLE_RATE } from "./realtimeStt";
import { isEchoOfSpoken, speakableText } from "./speechText";

export type VoicePhase = "off" | "listening" | "hearing" | "transcribing" | "speaking";

export type VoiceSessionEvents = {
  readonly onPhase: (phase: VoicePhase) => void;
  readonly onUtterance: (text: string) => void;
  readonly onError: (message: string) => void;
};

const FRAME_MS = 20;
const FRAME_SAMPLES = (STT_SAMPLE_RATE * FRAME_MS) / 1000;
const PRE_ROLL_FRAMES = 15;
const SPEECH_START_MS = 120;
const BARGE_IN_MS = 240;
const SPEECH_END_MS = 600;
const MIN_SPEECH_MS = 300;
const MIN_LEVEL = 0.012;
const MIN_BARGE_IN_LEVEL = 0.03;
const ECHO_WINDOW_FRAMES = 12;
const ECHO_MARGIN = 2;
const INITIAL_ECHO_COUPLING = 0.5;

// Captures the microphone as 16 kHz mono PCM in 20 ms frames, with each frame's level.
const CAPTURE_WORKLET = `
class T3VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / ${STT_SAMPLE_RATE};
    this.position = 0;
    this.frame = new Int16Array(${FRAME_SAMPLES});
    this.filled = 0;
    this.energy = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    for (; this.position < input.length; this.position += this.step) {
      const sample = Math.max(-1, Math.min(1, input[Math.floor(this.position)]));
      this.energy += sample * sample;
      this.frame[this.filled++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      if (this.filled === this.frame.length) {
        const level = Math.sqrt(this.energy / this.filled);
        this.port.postMessage({ pcm: this.frame, level }, [this.frame.buffer]);
        this.frame = new Int16Array(${FRAME_SAMPLES});
        this.filled = 0;
        this.energy = 0;
      }
    }
    this.position -= input.length;
    return true;
  }
}
registerProcessor("t3voice-capture", T3VoiceCapture);
`;

export class VoiceSession {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private capture: AudioWorkletNode | null = null;
  private player: SpeechPlayer | null = null;
  private readonly stt = new RealtimeStt();
  private preRoll: Int16Array[] = [];
  private noiseFloor = MIN_LEVEL / 3;
  private echoCoupling = INITIAL_ECHO_COUPLING;
  private playedLevels: number[] = [];
  private loudMs = 0;
  private quietMs = 0;
  private speechMs = 0;
  private inSpeech = false;
  private pendingTranscriptions = 0;
  private phase: VoicePhase = "off";

  constructor(private readonly events: VoiceSessionEvents) {}

  get active(): boolean {
    return this.stream !== null;
  }

  async start(): Promise<void> {
    if (this.stream !== null) return;
    this.stt.warm();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const context = new AudioContext();
    this.context = context;
    const moduleUrl = URL.createObjectURL(
      new Blob([CAPTURE_WORKLET], { type: "application/javascript" }),
    );
    await context.audioWorklet.addModule(moduleUrl);
    URL.revokeObjectURL(moduleUrl);
    const capture = new AudioWorkletNode(context, "t3voice-capture");
    capture.port.onmessage = (event: MessageEvent<{ pcm: Int16Array; level: number }>) =>
      this.onFrame(event.data.pcm, event.data.level);
    context.createMediaStreamSource(this.stream).connect(capture);
    // A silent sink keeps the capture node pulled by the audio graph.
    const sink = context.createGain();
    sink.gain.value = 0;
    capture.connect(sink).connect(context.destination);
    this.capture = capture;
    this.player = new SpeechPlayer(
      context,
      (speaking) => {
        if (!speaking) this.playedLevels = [];
        this.updatePhase();
      },
      this.events.onError,
    );
    this.updatePhase();
  }

  stop(): void {
    this.player?.stop();
    this.stt.close();
    if (this.capture !== null) this.capture.port.onmessage = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    void this.context?.close();
    this.stream = null;
    this.context = null;
    this.capture = null;
    this.player = null;
    this.inSpeech = false;
    this.setPhase("off");
  }

  /** Queues one sentence of a reply; empty or markdown-only text stays silent. */
  speak(text: string): void {
    const spoken = speakableText(text);
    if (spoken !== "") this.player?.speak(spoken);
  }

  stopSpeaking(): void {
    this.player?.stop();
  }

  private onFrame(pcm: Int16Array, level: number): void {
    const player = this.player;
    if (player === null) return;
    const speaking = player.speaking;

    // What the speakers are putting out over the last ~quarter second bounds the echo we can hear.
    let reference = 0;
    if (speaking) {
      this.playedLevels.push(player.level());
      if (this.playedLevels.length > ECHO_WINDOW_FRAMES) this.playedLevels.shift();
      reference = Math.max(...this.playedLevels);
    }

    const threshold = speaking
      ? Math.max(
          MIN_BARGE_IN_LEVEL,
          this.noiseFloor * 4,
          this.echoCoupling * reference * ECHO_MARGIN,
        )
      : Math.max(MIN_LEVEL, this.noiseFloor * 3);
    const loud = level > threshold;

    if (!this.inSpeech) {
      if (speaking && reference > 0.01) this.learnEchoCoupling(level / reference);
      else if (!loud && !speaking) this.noiseFloor = this.noiseFloor * 0.95 + level * 0.05;
    }

    if (loud) {
      this.loudMs += FRAME_MS;
      this.quietMs = 0;
    } else {
      // One quiet frame inside speech does not end the run.
      this.loudMs = Math.max(0, this.loudMs - FRAME_MS);
      this.quietMs += FRAME_MS;
    }

    if (!this.inSpeech) {
      this.preRoll.push(pcm);
      if (this.preRoll.length > PRE_ROLL_FRAMES) this.preRoll.shift();
      const startAfter = speaking ? BARGE_IN_MS : SPEECH_START_MS;
      if (this.loudMs >= startAfter) {
        if (speaking) player.stop();
        this.beginSpeech();
      }
      return;
    }

    this.stt.push(pcm);
    this.speechMs += FRAME_MS;
    if (this.quietMs >= SPEECH_END_MS) {
      const spokeLongEnough = this.speechMs - this.quietMs >= MIN_SPEECH_MS;
      this.inSpeech = false;
      this.speechMs = 0;
      this.loudMs = 0;
      if (spokeLongEnough) this.finishUtterance();
      else this.stt.discard();
      this.updatePhase();
    }
  }

  /** Tracks how loud our own speech comes back through the mic, without learning from Tim. */
  private learnEchoCoupling(ratio: number): void {
    if (ratio > this.echoCoupling * ECHO_MARGIN) return;
    const rate = ratio > this.echoCoupling ? 0.2 : 0.02;
    this.echoCoupling = Math.max(0.02, this.echoCoupling * (1 - rate) + ratio * rate);
  }

  private beginSpeech(): void {
    this.stt.warm();
    this.inSpeech = true;
    this.speechMs = this.loudMs;
    this.stt.discard();
    for (const frame of this.preRoll) this.stt.push(frame);
    this.preRoll = [];
    this.updatePhase();
  }

  private finishUtterance(): void {
    this.pendingTranscriptions += 1;
    this.blip();
    this.updatePhase();
    void this.stt
      .commit()
      .then((text) => {
        if (!/\p{L}/u.test(text) || this.stream === null) return;
        if (isEchoOfSpoken(text, this.player?.recentlySpoken() ?? [])) return;
        this.events.onUtterance(text);
      })
      .catch((error: unknown) => {
        this.events.onError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        this.pendingTranscriptions -= 1;
        this.updatePhase();
      });
  }

  /** A soft tick the moment an utterance is captured, so Tim hears he was heard. */
  private blip(): void {
    const context = this.context;
    if (context === null) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.04, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  }

  private updatePhase(): void {
    if (this.stream === null) return this.setPhase("off");
    if (this.inSpeech) return this.setPhase("hearing");
    if (this.player?.speaking) return this.setPhase("speaking");
    if (this.pendingTranscriptions > 0) return this.setPhase("transcribing");
    this.setPhase("listening");
  }

  private setPhase(phase: VoicePhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.events.onPhase(phase);
  }
}
