/**
 * Which speech engine t3 voice uses: ElevenLabs in the cloud, or Parakeet + Kokoro on this Mac
 * (`scripts/t3voice-speech.sh`). Kept per browser; speech code reads it at the start of each
 * utterance, so a switch takes effect on the next one.
 */
import { useSyncExternalStore } from "react";

export type SpeechEngine = "elevenlabs" | "local";

const KEY = "t3voice:engine";
const listeners = new Set<() => void>();

export function speechEngine(): SpeechEngine {
  return localStorage.getItem(KEY) === "local" ? "local" : "elevenlabs";
}

export function setSpeechEngine(engine: SpeechEngine): void {
  localStorage.setItem(KEY, engine);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSpeechEngine(): SpeechEngine {
  return useSyncExternalStore(subscribe, speechEngine);
}
