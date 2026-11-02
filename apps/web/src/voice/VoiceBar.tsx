import { MicIcon, PowerIcon } from "lucide-react";
import type { ReactNode } from "react";

import "./voiceBar.css";

export type VoiceBarState =
  | "off"
  | "listening"
  | "hearing"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

const WORD: Record<VoiceBarState, string> = {
  off: "Standby",
  listening: "Listening",
  hearing: "Hearing",
  transcribing: "Got it",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "No signal",
};

const HINT: Partial<Record<VoiceBarState, string>> = {
  listening: "Talk any time · tap to stop",
  hearing: "Go on",
  transcribing: "Sending to the voice thread",
  thinking: "Working on it",
  speaking: "Tap to stop the reply",
};

/**
 * The voice control, in Presence's call-frame look with a green HUD. The whole frame is one
 * button; what a tap does is in its label. `bottom` lifts it over a composer pinned below it.
 */
export function VoiceBar(props: {
  readonly state: VoiceBarState;
  readonly message: string | null;
  readonly disabled: boolean;
  readonly label: string;
  readonly bottom: number;
  readonly onPress: () => void;
  /** The speech engine switch (VoiceEngineToggle), on the top edge at the right. */
  readonly toggle?: ReactNode;
}) {
  const { state } = props;
  const hot = state === "hearing" || state === "speaking";
  return (
    <div
      data-t3voice-bar=""
      data-state={state}
      style={props.bottom > 0 ? { bottom: props.bottom } : undefined}
    >
      <button
        type="button"
        data-t3v="frame"
        aria-label={props.label}
        disabled={props.disabled}
        onClick={props.onPress}
      >
        <span data-t3v="room">
          <span data-t3v="strip" />
          {state === "off" ? (
            <>
              <span data-t3v="hatch" />
              <span data-t3v="plate">
                <PowerIcon aria-hidden />
                Start voice
              </span>
            </>
          ) : (
            <span data-t3v="line">{props.message ?? HINT[state] ?? ""}</span>
          )}
          <span data-t3v="rail" />
        </span>
        <span data-t3v="key" aria-hidden>
          <MicIcon />
        </span>
      </button>
      <span data-t3v="tab" data-hot={hot ? "" : undefined} aria-hidden>
        {state === "off" ? (
          <span data-t3v="glyph" data-hollow="" />
        ) : (
          <span data-t3v="glyph">
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
        <span data-t3v="word" data-t3voice-label>
          {WORD[state]}
        </span>
      </span>
      {props.toggle ? <span data-t3v="toggle">{props.toggle}</span> : null}
    </div>
  );
}
