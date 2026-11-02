import { useEffect } from "react";

const POLL_MS = 2_000;
// Voice states in which a reload would cut Tim off or lose what he just said.
const BUSY = new Set(["hearing", "transcribing", "thinking", "speaking"]);

function busy(): boolean {
  const state = document.querySelector<HTMLElement>("[data-t3voice-bar]")?.dataset.state ?? "";
  const active = document.activeElement;
  // The composer is focused on load; only a field with text in it means someone is typing.
  const typing =
    (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active.value
      : active instanceof HTMLElement && active.isContentEditable
        ? active.textContent
        : ""
    )?.trim() !== "";
  return BUSY.has(state) || typing;
}

/**
 * The phone's production build of t3 voice is rebuilt as the brain edits the UI
 * (scripts/t3voice-phone-build.mjs). This picks up a new build by reloading the page, but only while
 * voice is idle and nothing is being typed; until then it keeps waiting.
 */
export function PhoneBuildReload() {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- polls the served build id, which lives outside React
  useEffect(() => {
    let loaded: string | null = null;
    let outdated = false;
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
      if (outdated && !busy()) window.location.reload();
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
