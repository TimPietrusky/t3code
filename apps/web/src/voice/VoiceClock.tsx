import { useEffect, useState } from "react";
import "./voiceClock.css";

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** A small wall clock at the top centre; it repaints once a minute and never takes clicks. */
export function VoiceClock() {
  const [now, setNow] = useState(() => new Date());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the wall clock, re-armed on each minute boundary
  useEffect(() => {
    const untilNextMinute = () => 60_000 - (Date.now() % 60_000);
    const tick = () => {
      setNow(new Date());
      id = window.setTimeout(tick, untilNextMinute());
    };
    let id = window.setTimeout(tick, untilNextMinute());
    return () => window.clearTimeout(id);
  }, []);
  return (
    <time data-t3voice-clock="" dateTime={now.toISOString()}>
      {formatTime(now)}
    </time>
  );
}
