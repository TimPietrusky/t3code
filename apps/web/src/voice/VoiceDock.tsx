import { useLocation } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useEffectEvent, useState } from "react";

import { observeResize } from "~/lib/observeResize";
import { VoiceHost } from "./VoiceHost";
import { useVoiceOpen } from "./voiceOpen";

const COMPOSER = 'form[data-chat-composer-form="true"]';
const GAP_PX = 8;

/**
 * The voice bar while it is shown, at the bottom of the main content on whatever view is open, so
 * the call survives navigation. On a thread it sits just above the composer.
 */
export function VoiceDock() {
  return useVoiceOpen() ? <OpenVoiceDock /> : null;
}

function OpenVoiceDock() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [clearance, setClearance] = useState(0);
  // Presence lifts its bar with --kb; its frame sits ~18px above the bar's own bottom.
  const lift = Math.max(0, clearance - 18);
  return (
    <div
      data-t3voice-dock=""
      style={lift > 0 ? ({ "--kb": `${lift}px` } as CSSProperties) : undefined}
    >
      {/* Each view mounts its own composer, or none. */}
      <ComposerClearance key={pathname} onChange={setClearance} />
      <VoiceHost />
    </div>
  );
}

/** Reports how far above the bottom edge the bar must sit to clear a composer pinned there. */
function ComposerClearance({ onChange }: { readonly onChange: (clearance: number) => void }) {
  const report = useEffectEvent(onChange);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the composer's size and the visual viewport (keyboard), which React does not own
  useEffect(() => {
    let observed: Element | null = null;
    let stopObserving = () => {};
    function measure() {
      const form = document.querySelector(COMPOSER);
      if (form !== observed) {
        stopObserving();
        stopObserving = form === null ? () => {} : observeResize(form, measure);
        observed = form;
      }
      if (form === null) return report(0);
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const rect = form.getBoundingClientRect();
      // Presence's bar is centered and wide, so a composer pinned to the bottom is always under it.
      const pinned = rect.bottom > viewport - 80;
      report(pinned ? Math.ceil(viewport - rect.top) + GAP_PX : 0);
    }
    // The composer mounts a moment after the route changes.
    const timers = [0, 400, 1_500].map((delay) => window.setTimeout(measure, delay));
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      stopObserving();
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  return null;
}
