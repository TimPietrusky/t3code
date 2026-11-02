import { type SpeechEngine, setSpeechEngine, useSpeechEngine } from "./engine";
import "./voiceEngineToggle.css";

const ENGINES: ReadonlyArray<{ engine: SpeechEngine; short: string; name: string }> = [
  { engine: "elevenlabs", short: "11L", name: "ElevenLabs" },
  { engine: "local", short: "LAI", name: "Local AI" },
];

/**
 * The speech engine switch, "11L / LAI": ElevenLabs or local AI on this Mac. Self-contained, so a
 * voice bar only gives it a slot; the choice is kept per browser and applies from the next utterance.
 */
export function VoiceEngineToggle(props: { readonly onChange?: (engine: SpeechEngine) => void }) {
  const current = useSpeechEngine();
  return (
    <span data-t3voice-engine="" role="radiogroup" aria-label="Speech engine">
      {ENGINES.map(({ engine, short, name }) => (
        <button
          key={engine}
          type="button"
          role="radio"
          aria-checked={current === engine}
          aria-label={name}
          onClick={() => {
            setSpeechEngine(engine);
            props.onChange?.(engine);
          }}
        >
          {short}
        </button>
      ))}
    </span>
  );
}
