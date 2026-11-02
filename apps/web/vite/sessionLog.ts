// @effect-diagnostics-next-line nodeBuiltinImport:off -- Vite config runs before any Effect runtime.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Vite config runs before any Effect runtime.
import * as NodePath from "node:path";

/**
 * t3 voice's session log: one JSON line per event in sessions-YYYY-MM-DD.jsonl (local date), posted
 * by the page (voiceLog.ts). Text only: never audio, and keys that look like credentials are dropped.
 * `scripts/t3voice-log.mjs` prints the last session readably.
 */
const SESSION_LOG_DIR =
  process.env.T3VOICE_LOG_DIR?.trim() || NodePath.join(NodeOS.homedir(), "Library/Logs/t3voice");
const SECRET = /token|secret|password|authori[sz]ation|cookie|api.?key/i;
const MAX_TEXT = 4_000;
const MAX_EVENTS = 500;

function clean(value: unknown, depth = 0): unknown {
  if (typeof value === "string")
    return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (depth > 3) return undefined;
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => clean(entry, depth + 1));
  if (typeof value === "object" && value !== undefined) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SECRET.test(key))
        .map(([key, entry]) => [key, clean(entry, depth + 1)]),
    );
  }
  return undefined;
}

const today = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Appends the events (an array of objects) to today's file; returns how many were written. */
export function appendSessionEvents(events: unknown): number {
  if (!Array.isArray(events)) return 0;
  const lines = events
    .slice(0, MAX_EVENTS)
    .filter((event) => typeof event === "object" && event !== null)
    .map((event) => JSON.stringify({ at: new Date().toISOString(), ...(clean(event) as object) }));
  if (lines.length === 0) return 0;
  NodeFS.mkdirSync(SESSION_LOG_DIR, { recursive: true });
  NodeFS.appendFileSync(
    NodePath.join(SESSION_LOG_DIR, `sessions-${today()}.jsonl`),
    `${lines.join("\n")}\n`,
  );
  return lines.length;
}
