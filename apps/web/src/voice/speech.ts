/**
 * Hands-free speech for t3 voice: open mic, Presence's close-talk gate, realtime speech-to-text and
 * replies spoken sentence by sentence. Only Tim talking close to the mic starts a turn or cuts a reply
 * (presence/closetalk.js); a reply stops only when the gate hears him and the transcript has his words.
 */
import { type SpeechEngine, speechEngine } from "./engine";
import { SpeechPlayer } from "./player";
import { type CloseTalkMode, createCloseTalk } from "./presence/closetalk";
import { RealtimeStt, STT_SAMPLE_RATE } from "./realtimeStt";
import {
  foreignWords,
  hasForeignRun,
  hasRealWords,
  isNoisePhrase,
  isEchoOfSpoken,
  speakableText,
  stripEcho,
} from "./speechText";
import { voiceLog } from "./voiceLog";

export type VoicePhase = "off" | "listening" | "hearing" | "transcribing" | "speaking";

export type VoiceSessionEvents = {
  readonly onPhase: (phase: VoicePhase) => void;
  readonly onUtterance: (text: string) => void;
  readonly onError: (message: string) => void;
  /** A reply was cut off (barge-in): the bar shows Presence's stopped look. */
  readonly onStopped?: (reason: string) => void;
};

const FRAME_MS = 20;
const FRAME_SAMPLES = (STT_SAMPLE_RATE * FRAME_MS) / 1000;
const PRE_ROLL_FRAMES = 15;
// Wind, breath and handling rumble sit under this (Presence's WIND_CUT_HZ).
const WIND_CUT_HZ = 180;
// Our reply's echo is still in the room this long after its audio ends.
const ECHO_TAIL_MS = 600;
// While a reply plays the mic is transcribed in segments this long, to look for Tim's words.
const PROBE_SEGMENT_MS = 2_000;
// The gate heard Tim close while the reply played: his words must show within this.
const BARGE_WINDOW_MS = 2_500;
// Our own "heard you" tick is never Tim (Presence's gate.ignore during its call sounds).
const BLIP_IGNORE_MS = 180;
// A transcript taken over the reply counts as Tim when this share of its words are his (or it is short).
const MIN_THEIR_SHARE = 0.3;
const MAX_SHORT_INTERRUPTION = 6;
// Tim's close voice during a reply silences it at once (Tim, 2 Nov: "when I start talking, you stop
// talking immediately"). With no word of his in this long after the gate closes, or at most
// HOLD_MAX_MS, it was noise and the reply goes on.
const HOLD_RELEASE_MS = 700;
const HOLD_MAX_MS = 5_000;
// Our reply coming back through a speaker is quieter at the mic than the reply itself; Tim talking
// into it is not. A hold needs the mic within this many dB of what is playing, for HOLD_OVER_MS.
const HOLD_OVER_REPLY_DB = 3;
const HOLD_OVER_MS = 60;
// A segment never runs longer than this, even while the gate stays open on loud echo.
const MAX_SEGMENT_MS = 6_000;
// Under this much speech a lone word is a noise the recogniser named ("you", "the").
const MIN_LONE_WORD_MS = 500;
/**
 * How long after the gate closes (its own HOLD_MS of quiet, ~0.7 s, already past) Tim's turn ends,
 * by how his words so far end: a finished sentence ends soon, a pause after "and" or "um" waits.
 */
// A turn ends only after real silence, however long Tim talks (2 Nov: "never end my turn while I'm
// still speaking"): the gate's ~0.7 s hold, then this long with the mic near the room's floor and no
// new words. ~1.8 s after a finished sentence, ~2.3 s mid-sentence, ~3 s after "um" or "and".
const END_AFTER_SENTENCE_MS = 1_100;
const END_OPEN_MS = 1_600;
const END_HESITATION_MS = 2_300;
// Quiet means within this many dB of the room's floor: his soft trailing words are not.
const QUIET_OVER_FLOOR_DB = 8;
const HESITATION =
  /(?:,|\b(?:um+|uh+|er+|erm|and|but|so|or|because|cause|like|the|a|an|to|of|for|with|that|which|if|when|then|i|my|your|is|are|was|were|we|you|it)\s*)$/i;
// Backchannels never cut a reply off (ElevenLabs' interruption ignore terms, which Presence uses).
const BACKCHANNEL = new Set([
  "ok",
  "okay",
  "right",
  "sure",
  "yes",
  "yeah",
  "yep",
  "mhm",
  "mm",
  "hmm",
  "uh",
  "huh",
  "alright",
  "cool",
  "nice",
  "got",
  "it",
]);

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

// Scribe sometimes writes full-width punctuation ("is，um..." / "is。").
function asciiPunctuation(text: string): string {
  return text
    .replace(/[，、]/g, ", ")
    .replace(/。/g, ". ")
    .replace(/？/g, "? ")
    .replace(/！/g, "! ")
    .replace(/\s+/g, " ");
}

/** How long to wait after the gate closed before Tim's turn ends, from his words so far. */
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

function endpointWait(partial: string): { readonly ms: number; readonly rule: string } {
  const text = asciiPunctuation(partial).trim();
  if (text === "") return { ms: END_OPEN_MS, rule: "no-words-yet" };
  // A trailing "…" is a voice trailing off, not a finished sentence.
  if (HESITATION.test(text) || /(?:\.\.\.|…)$/.test(text)) {
    return { ms: END_HESITATION_MS, rule: "hesitation" };
  }
  if (/[.!?…]["')\]]*$/.test(text)) return { ms: END_AFTER_SENTENCE_MS, rule: "sentence" };
  return { ms: END_OPEN_MS, rule: "open" };
}

/** Words in `heard` that are neither ours coming back nor a backchannel: Tim interrupting. */
function interruptingWords(heard: string, spoken: ReadonlyArray<string>): ReadonlyArray<string> {
  return foreignWords(heard, spoken).filter((word) => !BACKCHANNEL.has(word));
}

/**
 * While a reply is on hold and the gate opened on Tim: one word of his that is not our echo nor
 * "mm-hmm" stops it. A hold alone (voiced, not open) never stops anything: loud echo gets that far.
 */
function isTakeover(heard: string, spoken: ReadonlyArray<string>): boolean {
  return !isNoisePhrase(heard) && interruptingWords(heard, spoken).length >= 1;
}

/**
 * Whether a transcript taken while the reply played has Tim in it: a run of his words, and enough
 * of them. A long transcript of our own echo always has a few garbled words; Tim's are a real share.
 */
function isInterruption(heard: string, spoken: ReadonlyArray<string>): boolean {
  const all = heard.toLowerCase().match(/\p{L}[\p{L}'’]*|\d+/gu) ?? [];
  if (isNoisePhrase(heard)) return false;
  const theirs = interruptingWords(heard, spoken);
  if (theirs.length < 2 || !hasForeignRun(heard, spoken)) return false;
  return all.length <= MAX_SHORT_INTERRUPTION || theirs.length / all.length >= MIN_THEIR_SHARE;
}

export class VoiceSession {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private capture: AudioWorkletNode | null = null;
  private player: SpeechPlayer | null = null;
  private input: AnalyserNode | null = null;
  private micLevel = 0;
  // The bar's wave reads these every frame; allocated once.
  private readonly spectrum = {
    input: new Uint8Array(1024),
    output: new Uint8Array(1024),
    inputWave: new Float32Array(2048),
    outputWave: new Float32Array(2048),
    rate: 48_000,
  };
  private readonly stt = new RealtimeStt();
  // A desktop mic sits further away than a phone held to the mouth: one sensitivity step more.
  private readonly gate = createCloseTalk({
    sensitivity: window.matchMedia("(pointer: coarse)").matches ? 0 : 1,
  });
  private ignoreGateUntil = 0;
  private thinking = false;
  private preRoll: Int16Array[] = [];
  private inSpeech = false;
  private speechMs = 0;
  private closedMs = 0;
  /** The room's level as the gate measures it (dB). */
  private floorDb = -60;
  private utteranceStartedAt = 0;
  private partial = "";
  private partials = 0;
  private startedDuringReply = false;
  private probing = false;
  private probeMs = 0;
  /** When the gate last opened on Tim's voice while a reply played (performance time), or 0. */
  private closeVoiceAt = 0;
  /** When the reply went on hold for Tim, and when the gate last heard him close since. */
  private holdAt = 0;
  private heldVoiceAt = 0;
  private holdArmed = true;
  private overReplyMs = 0;
  private replyDbs: number[] = [];
  /** When the gate last opened on Tim over a reply (not just voiced). */
  private strongVoiceAt = 0;
  private rejectedInSegment = false;
  private pendingTranscriptions = 0;
  /** Reply sentences held back while Tim has the floor. */
  private waiting: string[] = [];
  private phase: VoicePhase = "off";
  /** Chosen as each utterance starts; its reply is spoken with the same engine. */
  private engine: SpeechEngine = speechEngine();

  constructor(private readonly events: VoiceSessionEvents) {
    this.stt.onPartial = (text) => this.onPartial(text);
  }

  get active(): boolean {
    return this.stream !== null;
  }

  /** The brain is working on a reply: Tim needs a little more to cut in (Presence's "think" bar). */
  setThinking(thinking: boolean): void {
    this.thinking = thinking;
  }

  async start(): Promise<void> {
    if (this.stream !== null) return;
    // Mobile Safari only starts audio inside the tap itself, so the context comes before any await,
    // and play-and-record keeps replies audible with the ringer switch on silent.
    const context = new AudioContext();
    this.context = context;
    void context.resume();
    const audioSession = (navigator as { audioSession?: { type: string } }).audioSession;
    if (audioSession !== undefined) audioSession.type = "play-and-record";
    this.engine = speechEngine();
    this.stt.warm();
    // Presence's microphone: echo cancellation and noise suppression on, auto gain off (it lifts far
    // voices in the pauses and flattens Tim's, the difference the gate reads), voice isolation where
    // the platform has it.
    const constraints: MediaTrackConstraints & { voiceIsolation?: boolean } = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      voiceIsolation: true,
    };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    const moduleUrl = URL.createObjectURL(
      new Blob([CAPTURE_WORKLET], { type: "application/javascript" }),
    );
    await context.audioWorklet.addModule(moduleUrl);
    URL.revokeObjectURL(moduleUrl);
    const capture = new AudioWorkletNode(context, "t3voice-capture");
    capture.port.onmessage = (event: MessageEvent<{ pcm: Int16Array; level: number }>) =>
      this.onFrame(event.data.pcm, event.data.level);
    const microphone = context.createMediaStreamSource(this.stream);
    const windCut = context.createBiquadFilter();
    windCut.type = "highpass";
    windCut.frequency.value = WIND_CUT_HZ;
    microphone.connect(windCut);
    windCut.connect(capture);
    this.input = context.createAnalyser();
    this.input.fftSize = 2048;
    this.input.smoothingTimeConstant = 0.8;
    windCut.connect(this.input);
    // A silent sink keeps the capture node pulled by the audio graph.
    const sink = context.createGain();
    sink.gain.value = 0;
    capture.connect(sink).connect(context.destination);
    this.capture = capture;
    this.player = new SpeechPlayer(
      context,
      () => this.updatePhase(),
      this.events.onError,
      () => this.engine,
    );
    voiceLog("system", "mic.open", {
      engine: this.engine,
      context: context.state,
      rate: context.sampleRate,
      settings: this.stream.getAudioTracks()[0]?.getSettings?.() ?? null,
    });
    // iOS: opening the microphone switches the audio session and can leave the context suspended.
    if ((context.state as string) !== "running") void context.resume().catch(() => {});
    // The one microphone stream lives for the whole call; if the platform ends it, say so.
    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener("ended", () =>
        voiceLog("system", "mic.ended", { label: track.label }),
      );
      track.addEventListener("mute", () => voiceLog("system", "mic.muted"));
      track.addEventListener("unmute", () => voiceLog("system", "mic.unmuted"));
    }
    // A touch anywhere is the surest way to get a stalled iOS context running again.
    document.addEventListener("touchend", this.onTouch, { passive: true });
    this.updatePhase();
  }

  private readonly onTouch = (): void => {
    const context = this.context;
    if (context !== null && (context.state as string) !== "running") {
      voiceLog("voice", "audio.context.touch", { state: context.state });
      void context.resume().catch(() => {});
    }
  };

  stop(): void {
    this.waiting = [];
    this.player?.stop("call ended");
    this.player?.dispose();
    document.removeEventListener("touchend", this.onTouch);
    this.stt.close();
    if (this.capture !== null) this.capture.port.onmessage = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    void this.context?.close();
    this.stream = null;
    this.context = null;
    this.capture = null;
    this.player = null;
    this.input = null;
    this.inSpeech = false;
    this.probing = false;
    this.setPhase("off");
  }

  /** Queues one sentence of a reply; empty or markdown-only text stays silent. */
  speak(text: string): void {
    const spoken = speakableText(text);
    if (spoken === "") return;
    // Never over Tim: a reply that arrives while he talks (or his words are still being written
    // down) waits until his turn is over (2 Nov: a reply woken by another thread talked over him).
    if (this.timHasTheFloor() || this.waiting.length > 0) {
      if (this.waiting.length === 0) voiceLog("voice", "say.waiting", { text: spoken });
      this.waiting.push(spoken);
      return;
    }
    this.player?.speak(spoken);
  }

  private timHasTheFloor(): boolean {
    return this.inSpeech || this.gate.open || this.pendingTranscriptions > 0;
  }

  /**
   * This frame's levels (0..1) and the microphone's and the reply's spectrum and waveform, in the
   * shape Presence's wave (presence/callwave.js) reads; null while voice is off.
   */
  analysis(): {
    readonly levels: { readonly input: number; readonly output: number };
    readonly spectrum: VoiceSession["spectrum"];
  } | null {
    const player = this.player;
    if (this.context === null || this.input === null || player === null) return null;
    const spectrum = this.spectrum;
    spectrum.rate = this.context.sampleRate;
    this.input.getByteFrequencyData(spectrum.input);
    this.input.getFloatTimeDomainData(spectrum.inputWave);
    player.analyser.getByteFrequencyData(spectrum.output);
    player.analyser.getFloatTimeDomainData(spectrum.outputWave);
    return {
      levels: { input: Math.min(1, this.micLevel * 3), output: Math.min(1, player.level() * 3) },
      spectrum,
    };
  }

  /** Drops a queued sentence that has not started playing (the hold line when the real one lands). */
  cancelQueued(text: string): boolean {
    const waiting = this.waiting.indexOf(text);
    if (waiting >= 0) {
      this.waiting.splice(waiting, 1);
      return true;
    }
    return this.player?.drop(text) ?? false;
  }

  stopSpeaking(reason = "tap"): void {
    this.waiting = [];
    this.player?.stop(reason);
  }

  private onFrame(pcm: Int16Array, level: number): void {
    this.micLevel = level;
    const player = this.player;
    if (player === null) return;
    const now = performance.now();
    if (this.waiting.length > 0 && !this.timHasTheFloor()) {
      voiceLog("voice", "say.released", { sentences: this.waiting.length });
      for (const sentence of this.waiting) player.speak(sentence);
      this.waiting = [];
    }
    // The reply is heard while it plays, between its sentences and for its echo's tail.
    const replyAudible = player.speaking || now < player.audibleUntil + ECHO_TAIL_MS;
    const mode: CloseTalkMode = replyAudible ? "speak" : this.thinking ? "think" : "listen";
    const decision =
      now < this.ignoreGateUntil
        ? null
        : this.gate.step(10 * Math.log10(level * level + 1e-12), mode, FRAME_MS);
    if (decision) this.floorDb = decision.floor;
    if (decision?.opened || decision?.closed) {
      voiceLog("voice", decision.opened ? "gate.open" : "gate.close", {
        mode,
        by: decision.by,
        level: Math.round(decision.level),
        bar: Math.round(decision.bar),
        floor: Math.round(decision.floor),
        voice: Math.round(decision.voice),
      });
    }

    // Tim's close voice over the reply: it goes quiet now; his words make it a stop, else it goes on.
    // Voiced is ~90 ms over the barge-in bar; a new hold needs a quiet moment since the last one.
    const close = this.gate.voiced || this.gate.open;
    if (!close) this.holdArmed = true;
    // Against the reply's loudest moment in the last ~200 ms: its echo arrives late and rings on.
    this.replyDbs.push(20 * Math.log10(player.level() + 1e-9));
    if (this.replyDbs.length > 10) this.replyDbs.shift();
    const overReply =
      20 * Math.log10(level + 1e-9) >= Math.max(...this.replyDbs) - HOLD_OVER_REPLY_DB;
    this.overReplyMs = close && overReply ? this.overReplyMs + FRAME_MS : 0;
    if (decision?.opened && decision.by === "speak") this.closeVoiceAt = this.strongVoiceAt = now;
    if (
      this.overReplyMs >= HOLD_OVER_MS &&
      this.holdArmed &&
      replyAudible &&
      player.speaking &&
      !player.holding
    ) {
      if (this.stt.speechOnly) {
        this.holdArmed = false;
        this.holdAt = now;
        player.hold();
      }
    }
    if (player.holding) {
      if (this.gate.open || this.gate.voiced) this.heldVoiceAt = now;
      else if (this.heldVoiceAt < this.holdAt) this.heldVoiceAt = this.holdAt;
      if (now - this.heldVoiceAt >= HOLD_RELEASE_MS || now - this.holdAt >= HOLD_MAX_MS) {
        voiceLog("voice", "barge.released", { heldMs: Math.round(now - this.holdAt) });
        player.release();
      }
    }

    if (this.probing && !this.stt.speechOnly) {
      // Switched to a local service without voice detection mid-segment: nothing here counts.
      this.probing = false;
      this.stt.discard();
    }
    if (this.probing) {
      this.stt.push(pcm);
      this.probeMs += FRAME_MS;
      if (decision?.opened && decision.by === "speak") this.closeVoiceAt = now;
      // The reply ended while Tim is talking (he answers the moment the question ends): the segment
      // is his turn, not a probe (2 Nov: his "keep it" vanished three times between reply and turn).
      if (!replyAudible && (this.gate.open || this.gate.voiced)) {
        this.probeToTurn();
        return;
      }
      // A segment never ends while someone talks close: Tim's interruption stays in one transcript.
      if (
        !replyAudible ||
        (this.probeMs >= PROBE_SEGMENT_MS && !this.gate.open && !this.gate.voiced) ||
        this.probeMs >= MAX_SEGMENT_MS
      ) {
        this.endProbe();
      }
      return;
    }

    if (!this.inSpeech) {
      this.preRoll.push(pcm);
      if (this.preRoll.length > PRE_ROLL_FRAMES) this.preRoll.shift();
      // During a reply the mic goes to speech-to-text only once the gate hears someone close (its
      // pre-roll keeps the onset): a quiet room sends nothing (the eval: 182 empty transcripts in 6 min).
      // During a reply only a transcript that is surely speech may cut it: local speech without its
      // voice detection turns breath and noise into "I'm sorry." (2 Nov: Tim's replies cut off).
      if (replyAudible) {
        if ((this.gate.voiced || this.gate.open) && this.stt.speechOnly) this.beginProbe();
      } else if (decision?.opened || this.gate.open) {
        // Opened now, or already open from the reply's last moments: either way Tim is talking.
        this.beginSpeech(false);
      }
      return;
    }

    this.stt.push(pcm);
    this.speechMs += FRAME_MS;
    const quiet =
      !this.gate.open &&
      !this.gate.voiced &&
      20 * Math.log10(level + 1e-9) < this.floorDb + QUIET_OVER_FLOOR_DB;
    this.closedMs = quiet ? this.closedMs + FRAME_MS : 0;
    const wait = endpointWait(this.partial);
    if (this.closedMs >= wait.ms) {
      voiceLog("voice", "turn.end", {
        rule: wait.rule,
        // The gate's own hold (~0.7 s of quiet) plus the wait after it closed.
        silenceMs: 700 + this.closedMs,
        partial: this.partial,
      });
      this.inSpeech = false;
      this.finishUtterance();
      this.updatePhase();
    }
  }

  /**
   * While a reply plays, the mic streams in short segments; a reply stops only when the gate hears
   * Tim close (in its speaking mode) and the segment's transcript has words that are his.
   */
  private beginProbe(): void {
    this.stt.warm();
    this.probing = true;
    this.probeMs = 0;
    this.rejectedInSegment = false;
    this.stt.discard();
    for (const frame of this.preRoll) this.stt.push(frame);
    this.preRoll = [];
  }

  private probeToTurn(): void {
    voiceLog("voice", "probe.to-turn", { ms: this.probeMs });
    this.probing = false;
    this.inSpeech = true;
    this.startedDuringReply = false;
    this.utteranceStartedAt = performance.now() - this.probeMs;
    this.speechMs = this.probeMs;
    this.closedMs = 0;
    this.partial = "";
    this.partials = 0;
    this.updatePhase();
  }

  private strongVoice(): boolean {
    return this.gate.open || performance.now() - this.strongVoiceAt < BARGE_WINDOW_MS;
  }

  private closeVoiceRecently(): boolean {
    return this.gate.open || performance.now() - this.closeVoiceAt < BARGE_WINDOW_MS;
  }

  private onPartial(text: string): void {
    if (this.inSpeech) {
      // New words are Tim still talking, whatever the level says.
      if (wordCount(text) > wordCount(this.partial)) this.closedMs = 0;
      this.partial = text;
      this.partials += 1;
      return;
    }
    if (!this.probing) return;
    const spoken = this.player?.recentlySpoken() ?? [];
    if (this.player?.holding && this.strongVoice() && isTakeover(text, spoken)) {
      this.bargeIn("Tim took over", text);
      return;
    }
    if (!isInterruption(text, spoken)) return;
    if (this.closeVoiceRecently()) {
      this.bargeIn("close voice and new words", text);
    } else if (!this.rejectedInSegment) {
      // Echo or room noise the recogniser turned into words: the gate heard nobody close.
      this.rejectedInSegment = true;
      voiceLog("voice", "barge.rejected", { reason: "words without a close voice", heard: text });
    }
  }

  /** Tim is talking over the reply: stop it and keep the segment's audio as his utterance. */
  private bargeIn(reason: string, heard: string): void {
    voiceLog("voice", "barge.in", { reason, heard });
    this.player?.stop(`barge-in: ${reason}`);
    this.events.onStopped?.(reason);
    this.probing = false;
    this.inSpeech = true;
    this.startedDuringReply = true;
    this.utteranceStartedAt = performance.now() - this.probeMs;
    this.speechMs = this.probeMs;
    this.closedMs = 0;
    this.partial = heard;
    this.partials = 1;
    this.updatePhase();
  }

  /** Closes a segment. Its final transcript can still show Tim (partials lag); else it was echo. */
  private endProbe(): void {
    this.probing = false;
    const closeVoice = this.closeVoiceRecently();
    const strong = this.strongVoice();
    const ms = this.probeMs;
    void this.stt
      .commit({ fallback: false })
      .then((text) => {
        voiceLog("voice", "probe.segment", { ms, chars: text.trim().length, closeVoice });
        if (this.stream === null || text.trim() === "") return;
        const spoken = this.player?.recentlySpoken() ?? [];
        const takeover = Boolean(this.player?.holding) && strong && isTakeover(text, spoken);
        if (!takeover && !isInterruption(text, spoken)) return;
        if (!closeVoice) {
          voiceLog("voice", "barge.rejected", {
            reason: "words without a close voice",
            heard: text,
          });
          return;
        }
        voiceLog("voice", "barge.in", {
          reason: "close voice and new words (segment end)",
          heard: text,
        });
        this.player?.stop("barge-in: close voice and new words (segment end)");
        this.events.onStopped?.("close voice and new words");
        this.deliver(stripEcho(text, spoken), spoken, {
          speechMs: PROBE_SEGMENT_MS,
          duringReply: true,
        });
      })
      .catch(() => {});
  }

  private beginSpeech(duringReply: boolean): void {
    this.engine = speechEngine();
    this.stt.warm();
    this.inSpeech = true;
    this.startedDuringReply = duringReply;
    this.utteranceStartedAt = performance.now() - this.preRoll.length * FRAME_MS;
    this.speechMs = 0;
    this.closedMs = 0;
    this.partial = "";
    this.partials = 0;
    this.stt.discard();
    for (const frame of this.preRoll) this.stt.push(frame);
    this.preRoll = [];
    this.updatePhase();
  }

  private finishUtterance(): void {
    const startedDuringReply = this.startedDuringReply;
    const speechMs = this.speechMs - this.closedMs;
    const partials = this.partials;
    const partial = this.partial;
    const startedAt = this.utteranceStartedAt;
    this.pendingTranscriptions += 1;
    // Noise that opened the gate has no words yet; a tick for it would sound like being heard.
    if (hasRealWords(partial)) this.blip();
    this.updatePhase();
    void this.stt
      .commit()
      .then((committed) => {
        const spoken = this.player?.recentlySpoken() ?? [];
        // The final transcript came back empty though the partials had words: they were heard
        // (2 Nov: Tim's answer to "how much per day?" showed "Yeah, yeah." and then vanished).
        const fromPartial = committed.trim() === "" && hasRealWords(partial);
        if (fromPartial) voiceLog("tim", "transcript.from-partial", { partial });
        const text = fromPartial ? partial : committed;
        this.deliver(startedDuringReply ? stripEcho(text, spoken) : text, spoken, {
          speechMs,
          partials,
          startedAt,
          duringReply: startedDuringReply,
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        voiceLog("system", "error", { where: "stt", engine: this.engine, message });
        this.events.onError(message);
      })
      .finally(() => {
        this.pendingTranscriptions -= 1;
        this.updatePhase();
      });
  }

  private deliver(
    transcript: string,
    spoken: ReadonlyArray<string>,
    info: {
      readonly speechMs: number;
      readonly partials?: number;
      readonly startedAt?: number;
      readonly duringReply: boolean;
    },
  ): void {
    const heard = asciiPunctuation(transcript)
      .replace(/^[\s.,;:!?…-]+/, "")
      .trim();
    const words = heard.split(/\s+/).filter(Boolean);
    const drop = !hasRealWords(heard)
      ? "no real words"
      : this.engine === "local" && isNoisePhrase(heard)
        ? "a phrase made up from noise"
        : isEchoOfSpoken(heard, spoken)
          ? "our own words coming back"
          : words.length === 1 && info.speechMs < MIN_LONE_WORD_MS
            ? "a lone word from a short noise"
            : null;
    const detail = {
      text: heard,
      engine: this.engine,
      speechMs: Math.round(info.speechMs),
      partials: info.partials ?? null,
      startedMsAgo: info.startedAt ? Math.round(performance.now() - info.startedAt) : null,
      duringReply: info.duringReply,
    };
    if (this.stream === null) return;
    if (drop !== null) {
      voiceLog("tim", "utterance.dropped", { ...detail, reason: drop });
      return;
    }
    voiceLog("tim", "utterance", detail);
    this.events.onUtterance(heard);
  }

  /** A soft tick the moment an utterance is captured, so Tim hears he was heard. */
  private blip(): void {
    const context = this.context;
    if (context === null) return;
    this.ignoreGateUntil = performance.now() + BLIP_IGNORE_MS;
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
