import { useSyncExternalStore } from "react";

// The app's side is ../streamerMode.tsx, which this folder may not import: same key, event and scramble.
const STORE = "t3voice:streamer";
const EVENT = "t3voice:streamer";

const read = () => {
  try {
    return localStorage.getItem(STORE) === "on";
  } catch {
    return false;
  }
};

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export const useStreamer = () => useSyncExternalStore(subscribe, read, () => false);

export function setStreamer(on: boolean) {
  localStorage.setItem(STORE, on ? "on" : "off");
  window.dispatchEvent(new Event(EVENT));
}

const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SALT = Math.floor(Math.random() * 0x7fffffff);

function scramble(text: string): string {
  let place = 0;
  return text.replace(/\S+/g, (word) => {
    let seed = (2166136261 ^ (SALT + place++)) >>> 0;
    for (let i = 0; i < word.length; i++) seed = Math.imul(seed ^ word.charCodeAt(i), 16777619);
    let out = "";
    for (let i = 0; i < word.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      out += GLYPHS[(seed >>> 0) % GLYPHS.length];
    }
    return out;
  });
}

/** Content text the app's streamer mode scrambles; the app's CSS pixelates `data-streamer-text`. */
export function Hidden({ text }: { readonly text: string }) {
  return useStreamer() ? <span data-streamer-text="">{scramble(text)}</span> : text;
}
