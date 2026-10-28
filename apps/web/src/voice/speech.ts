/**
 * Hands-free speech for t3 voice: open mic, energy voice detection, realtime speech-to-text, and
 * replies spoken sentence by sentence. Barge-in only fires when the mic is clearly louder than the
 * echo of what is playing, and transcripts of our own words are dropped (laptop speakers).
 */
import { SpeechPlayer } from "./player";
import { RealtimeStt, STT_SAMPLE_RATE } from "./realtimeStt";
import {
  foreignWords,
  hasForeignRun,
  hasRealWords,
  isEchoOfSpoken,
  speakableText,
  stripEcho,
} from "./speechText";

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
const INITIAL_ECHO_COUPLING = 1;
const ECHO_COUPLING_KEY = "t3voice:echo-coupling";
const PROBE_SEGMENT_MS = 2_000;
const MIN_ECHO_COUPLING = 0.05;
const ELEVATED_OVER_TYPICAL = 1.6;
const ELEVATED_MIN_MS = 100;
// localStorage["t3voice:debug"] = "1" logs barge-in decisions to the console.
const debug = (...parts: unknown[]) => {
  if (localStorage.getItem("t3voice:debug") === "1") console.info("[t3voice]", ...parts);
};

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
  private echoCoupling = Number(localStorage.getItem(ECHO_COUPLING_KEY)) || INITIAL_ECHO_COUPLING;
  private probeMaxRatio = 0;
  private probeRatioSum = 0;
  private probeRatioFrames = 0;
  private elevatedMs = 0;
  /** The usual mic-to-speaker ratio while only our echo is heard. */
  private echoTypical = 0.3;
  private playedLevels: number[] = [];
  private loudMs = 0;
  private quietMs = 0;
  private speechMs = 0;
  private inSpeech = false;
  private startedDuringReply = false;
  private probing = false;
  private probeMs = 0;
  private lastForeign: ReadonlyArray<string> = [];
  private segmentTail: { readonly text: string; readonly at: number } | null = null;
  private pendingTranscriptions = 0;
  private phase: VoicePhase = "off";

  constructor(private readonly events: VoiceSessionEvents) {
    this.stt.onPartial = (text) => this.onPartial(text);
  }

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
    const echo = this.echoCoupling * reference;
    const floor = speaking
      ? Math.max(MIN_BARGE_IN_LEVEL, this.noiseFloor * 4)
      : Math.max(MIN_LEVEL, this.noiseFloor * 3);
    const loud = level > Math.max(floor, speaking ? echo * ECHO_MARGIN : 0);
    if (!loud && !speaking && !this.inSpeech) {
      this.noiseFloor = this.noiseFloor * 0.95 + level * 0.05;
    }

    if (loud) {
      this.loudMs += FRAME_MS;
      this.quietMs = 0;
    } else {
      // One quiet frame inside speech does not end the run.
      this.loudMs = Math.max(0, this.loudMs - FRAME_MS);
      this.quietMs += FRAME_MS;
    }

    if (this.probing) {
      this.stt.push(pcm);
      this.probeMs += FRAME_MS;
      if (reference > 0.01) {
        const ratio = level / reference;
        this.probeMaxRatio = Math.max(this.probeMaxRatio, ratio);
        this.probeRatioSum += ratio;
        this.probeRatioFrames += 1;
        if (ratio > this.echoTypical * ELEVATED_OVER_TYPICAL) this.elevatedMs += FRAME_MS;
      }
      if (speaking && this.loudMs >= BARGE_IN_MS) {
        debug("barge: loud", { level, echo });
        this.bargeIn();
      } else if (!speaking || this.probeMs >= PROBE_SEGMENT_MS) {
        this.endProbe();
      }
      return;
    }

    if (!this.inSpeech) {
      this.preRoll.push(pcm);
      if (this.preRoll.length > PRE_ROLL_FRAMES) this.preRoll.shift();
      if (speaking) this.beginProbe();
      else if (this.loudMs >= SPEECH_START_MS) this.beginSpeech(false);
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

  /**
   * While a reply plays, the mic streams in short segments whose transcript shows whether Tim is
   * talking over it; energy alone cannot tell him from loud speaker echo.
   */
  private beginProbe(): void {
    this.stt.warm();
    this.probing = true;
    this.probeMs = 0;
    this.lastForeign = [];
    this.probeMaxRatio = 0;
    this.probeRatioSum = 0;
    this.probeRatioFrames = 0;
    this.elevatedMs = 0;
    this.stt.discard();
    for (const frame of this.preRoll) this.stt.push(frame);
    this.preRoll = [];
  }

  // A run of words we did not say is Tim; so is a word of his that survives into the next partial.
  private onPartial(text: string): void {
    if (!this.probing) return;
    const spoken = this.player?.recentlySpoken() ?? [];
    const foreign = foreignWords(text, spoken);
    const repeated = foreign.some((word) => this.lastForeign.includes(word));
    this.lastForeign = foreign;
    // Tim also adds energy over the usual echo; a garbled echo ("carbon dioxide") does not.
    if ((hasForeignRun(text, spoken) || repeated) && this.elevatedMs >= ELEVATED_MIN_MS) {
      debug("barge: transcript", text);
      this.bargeIn();
    }
  }

  /** Tim is talking over the reply: stop it and keep the segment's audio as his utterance. */
  private bargeIn(): void {
    this.player?.stop();
    this.probing = false;
    this.inSpeech = true;
    this.startedDuringReply = true;
    this.speechMs = this.probeMs;
    this.quietMs = 0;
    this.updatePhase();
  }

  /** Closes a segment. Its final transcript can still show Tim (partials lag); else it was echo. */
  private endProbe(): void {
    this.probing = false;
    const ratio = this.probeMaxRatio;
    const typical = this.probeRatioFrames > 0 ? this.probeRatioSum / this.probeRatioFrames : null;
    const elevated = this.elevatedMs >= ELEVATED_MIN_MS;
    void this.stt
      .commit({ fallback: false })
      .then((text) => {
        const spoken = this.player?.recentlySpoken() ?? [];
        if (this.stream === null) return;
        if (hasForeignRun(text, spoken) && elevated) {
          debug("barge: late transcript", text);
          this.player?.stop();
          this.deliver(this.withSegmentTail(stripEcho(text, spoken)), spoken);
          return;
        }
        // A lone word of Tim's at a segment's end ("wait") belongs to what comes next.
        const tail = stripEcho(text, spoken);
        this.segmentTail = tail === "" ? null : { text: tail, at: performance.now() };
        // Rise fast, sink slowly: how loud our own echo gets sets the energy barge-in bar.
        this.echoCoupling =
          ratio > this.echoCoupling ? ratio : this.echoCoupling * 0.9 + ratio * 0.1;
        this.echoCoupling = Math.max(MIN_ECHO_COUPLING, this.echoCoupling);
        if (typical !== null) this.echoTypical = this.echoTypical * 0.7 + typical * 0.3;
        localStorage.setItem(ECHO_COUPLING_KEY, String(this.echoCoupling));
      })
      .catch(() => {});
  }

  private beginSpeech(duringReply: boolean): void {
    this.stt.warm();
    this.inSpeech = true;
    this.startedDuringReply = duringReply;
    this.speechMs = this.loudMs;
    this.stt.discard();
    for (const frame of this.preRoll) this.stt.push(frame);
    this.preRoll = [];
    this.updatePhase();
  }

  private finishUtterance(): void {
    const startedDuringReply = this.startedDuringReply;
    this.pendingTranscriptions += 1;
    this.blip();
    this.updatePhase();
    void this.stt
      .commit()
      .then((text) => {
        const spoken = this.player?.recentlySpoken() ?? [];
        this.deliver(
          startedDuringReply ? this.withSegmentTail(stripEcho(text, spoken)) : text,
          spoken,
        );
      })
      .catch((error: unknown) => {
        this.events.onError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        this.pendingTranscriptions -= 1;
        this.updatePhase();
      });
  }

  private withSegmentTail(text: string): string {
    const tail = this.segmentTail;
    this.segmentTail = null;
    return tail !== null && performance.now() - tail.at < 3_000 ? `${tail.text} ${text}` : text;
  }

  private deliver(transcript: string, spoken: ReadonlyArray<string>): void {
    const heard = transcript.replace(/^[\s.,;:!?…-]+/, "");
    if (this.stream === null || !hasRealWords(heard) || isEchoOfSpoken(heard, spoken)) return;
    this.events.onUtterance(heard);
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
