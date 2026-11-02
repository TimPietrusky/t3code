import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { type CallWaveLevels, type CallWaveSpectrum, createCallWave } from "./presence/callwave";
import { createFrame, type PresenceFrame } from "./presence/frame";
import { useUpdateReady } from "./phoneUpdate";
import { BAR_HTML } from "./presence/markup";
import "./presence/presence.css";
import "./voiceBar.css";

export type VoiceBarState =
  | "off"
  | "connecting"
  | "listening"
  | "hearing"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export type VoiceBarAnalysis = {
  readonly levels: CallWaveLevels;
  readonly spectrum: CallWaveSpectrum | null;
};

// Our states in Presence's terms (frame.js `state({ line, voice })`): Tim talking is listening.
const PRESENCE_STATE: Record<VoiceBarState, { line: string; voice: string }> = {
  off: { line: "idle", voice: "idle" },
  connecting: { line: "connecting", voice: "connecting" },
  listening: { line: "listening", voice: "listening" },
  hearing: { line: "listening", voice: "listening" },
  transcribing: { line: "thinking", voice: "thinking" },
  thinking: { line: "thinking", voice: "thinking" },
  speaking: { line: "speaking", voice: "speaking" },
  error: { line: "error", voice: "error" },
};

// Nothing moving out of a call: the wave polls instead of drawing every frame (Presence's REST_MS).
const REST_MS = 100;

/**
 * The voice control: Presence's call frame itself (presence/, copied by
 * scripts/t3voice-presence-sync.mjs, green instead of red), driven by t3 voice's state and audio.
 * The room is the one tap target (no key: T3's composer is right there); `toggle` sits in a small
 * tab on the top edge. `bottom` lifts the frame over a composer pinned below it.
 */
export function VoiceBar(props: {
  readonly state: VoiceBarState;
  readonly message: string | null;
  readonly disabled: boolean;
  readonly label: string;
  readonly bottom: number;
  readonly onPress: () => void;
  /** Small controls for the slot tab on the top edge (the engine switch, VoiceEngineToggle). */
  readonly toggle?: ReactNode;
  /** This frame's audio for the wave; null while voice is off. */
  readonly analysis?: () => VoiceBarAnalysis | null;
  /** Bump to show Presence's "stopped" look (a reply cut off by Tim). */
  readonly stoppedAt?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<PresenceFrame | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const updateReady = useUpdateReady();

  const press = useEffectEvent(() => props.onPress());
  const readAnalysis = useEffectEvent(() => props.analysis?.() ?? null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- mounts Presence's own DOM-driven frame and wave once; they live outside React
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    root.innerHTML = BAR_HTML;
    const bar = root.querySelector<HTMLElement>("[data-bar]");
    const frameEl = root.querySelector<HTMLElement>("[data-frame]");
    const canvas = root.querySelector<HTMLCanvasElement>("[data-light]");
    if (bar === null || frameEl === null || canvas === null) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = createFrame({ bar, frame: frameEl, reduced });
    frameRef.current = frame;
    const light = createCallWave(canvas, {
      reduced,
      wash: root.querySelector("[data-wash]"),
      state: () => ({ look: frame.look, audio: frame.audio, reading: false, open: false }),
      bars: () => frameEl.querySelector("[data-glyph] .g-bars"),
    });

    const talk = root.querySelector<HTMLButtonElement>("[data-talk]");
    const onTalk = () => press();
    talk?.addEventListener("click", onTalk);
    setSlot(root.querySelector<HTMLElement>("[data-slot]"));

    let stopped = false;
    let handle = 0;
    const tick = () => {
      if (stopped) return;
      const analysis = readAnalysis();
      light.frame(analysis?.levels ?? {}, analysis?.spectrum ?? null);
      handle =
        analysis === null && light.resting
          ? window.setTimeout(tick, REST_MS)
          : window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      window.clearTimeout(handle);
      window.cancelAnimationFrame(handle);
      talk?.removeEventListener("click", onTalk);
      frameRef.current = null;
      root.replaceChildren();
    };
  }, []);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells Presence's frame (DOM, outside React) what voice is doing
  useEffect(() => {
    frameRef.current?.state(PRESENCE_STATE[props.state]);
    const root = rootRef.current;
    const talk = root?.querySelector<HTMLButtonElement>("[data-talk]");
    if (talk) {
      talk.setAttribute("aria-label", props.label);
      talk.disabled = props.disabled;
    }
    // One quiet line over the frame, only for something Tim must know (Presence's .bar-incoming).
    const incoming = root?.querySelector<HTMLElement>("[data-incoming]");
    if (incoming) {
      incoming.hidden = props.message === null;
      const line = document.createElement("li");
      line.textContent = props.message ?? "";
      incoming.replaceChildren(...(props.message === null ? [] : [line]));
    }
  }, [props.state, props.label, props.disabled, props.message]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Presence's stopped look when Tim cuts a reply off
  useEffect(() => {
    if (props.stoppedAt) frameRef.current?.stopped();
  }, [props.stoppedAt]);

  // Presence lifts its bar with --kb; its frame sits ~18px above the bar's own bottom.
  const lift = Math.max(0, props.bottom - 18);
  return (
    <>
      <div
        ref={rootRef}
        data-t3voice-presence=""
        // PhoneBuildReload reads this: no reload unless voice is off.
        data-voice-state={props.state}
        style={lift > 0 ? ({ "--kb": `${lift}px` } as CSSProperties) : undefined}
      />
      {slot !== null
        ? createPortal(
            <>
              {updateReady ? (
                // A newer phone build waits; during a call it applies only on this tap.
                <button
                  type="button"
                  data-t3voice-update=""
                  onClick={() => window.location.reload()}
                >
                  update
                </button>
              ) : null}
              {props.toggle}
            </>,
            slot,
          )
        : null}
    </>
  );
}
