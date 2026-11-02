import { setStreamer, useStreamer } from "./streamer";

/** Streamer mode on and off, for the whole app: titles and messages scramble and pixelate. */
export function StreamerToggle() {
  const on = useStreamer();
  return (
    <button
      type="button"
      data-t3voice-streamer=""
      aria-pressed={on}
      onClick={() => setStreamer(!on)}
    >
      {on ? "Streamer on" : "Streamer"}
    </button>
  );
}
