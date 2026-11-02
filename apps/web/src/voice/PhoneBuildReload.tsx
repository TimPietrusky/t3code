import { useEffect } from "react";

import { markUpdateReady } from "./phoneUpdate";
import { voiceLog } from "./voiceLog";

const POLL_MS = 2_000;

/** Reloading is only safe with the mic off (the bar on standby) and nothing typed in a field. */
function idle(): boolean {
  const state =
    document.querySelector<HTMLElement>("[data-t3voice-presence]")?.dataset.voiceState ?? "off";
  const active = document.activeElement;
  // The composer is focused on load; only a field with text in it means someone is typing.
  const typing =
    (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active.value
      : active instanceof HTMLElement && active.isContentEditable
        ? active.textContent
        : ""
    )?.trim() !== "";
  return state === "off" && !typing;
}

/**
 * The phone's production build of t3 voice is rebuilt as the brain edits the UI
 * (scripts/t3voice-phone-build.mjs). This picks up a new build by reloading the page, but never
 * during a call: with the mic on, the bar shows an update chip (a tap applies it) and the reload
 * waits until the mic is off and nothing is being typed.
 */
export function PhoneBuildReload() {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- polls the served build id, which lives outside React
  useEffect(() => {
    let loaded: string | null = null;
    let outdated = false;
    let announced = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/t3voice-build.json", { cache: "no-store" });
        if (response.ok) {
          const { id } = (await response.json()) as { id?: string };
          if (typeof id === "string") {
            if (loaded === null) loaded = id;
            else if (id !== loaded) outdated = true;
          }
        }
      } catch {
        // Offline for a moment; the next poll tries again.
      }
      if (!outdated) return;
      if (!announced) {
        announced = true;
        voiceLog("system", "update.ready", { idle: idle() });
      }
      markUpdateReady();
      if (idle()) {
        voiceLog("system", "reload", { why: "new phone build, voice off" });
        window.location.reload();
      }
    }
    void check();
    const timer = window.setInterval(() => void check(), POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return null;
}
