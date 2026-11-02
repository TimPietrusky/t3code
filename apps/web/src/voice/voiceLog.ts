/**
 * t3 voice's session log: events go in small batches to `/__t3voice/log` (vite/sessionLog.ts), one
 * JSON line each in ~/Library/Logs/t3voice/sessions-YYYY-MM-DD.jsonl; text only, never audio.
 * `who`: tim (his words), voice (speaking, stops, barge-in), brain (the thread), system.
 */
export type VoiceLogWho = "tim" | "voice" | "brain" | "system";

const page = Math.random().toString(36).slice(2, 10);
let session: string | null = null;
let queue: Array<Record<string, unknown>> = [];
let timer: number | null = null;

function flush(beacon = false): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  if (queue.length === 0) return;
  const body = JSON.stringify(queue);
  queue = [];
  if (
    beacon &&
    navigator.sendBeacon?.("/__t3voice/log", new Blob([body], { type: "application/json" }))
  ) {
    return;
  }
  void fetch("/__t3voice/log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function voiceLog(who: VoiceLogWho, type: string, data: Record<string, unknown> = {}): void {
  queue.push({ t: new Date().toISOString(), page, session, who, type, ...data });
  if (queue.length >= 40) flush();
  else timer ??= window.setTimeout(() => flush(), 1_500);
}

/** A call starts (mic on): later events carry its id until it ends. */
export function startVoiceLogSession(data: Record<string, unknown> = {}): void {
  session = `${new Date().toISOString().slice(11, 19).replaceAll(":", "")}-${Math.random().toString(36).slice(2, 6)}`;
  voiceLog("system", "session.start", data);
}

export function endVoiceLogSession(reason: string): void {
  voiceLog("system", "session.end", { reason });
  flush();
  session = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    voiceLog("system", "page.hide");
    flush(true);
  });
  voiceLog("system", "page.load", {
    ua: navigator.userAgent.slice(0, 160),
    touch: window.matchMedia("(pointer: coarse)").matches,
  });
}
