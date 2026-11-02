import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { observeResize } from "~/lib/observeResize";

const COMPOSER = 'form[data-chat-composer-form="true"]';
const GAP_PX = 8;
// The voice bar's width plus its edge on wide screens (voiceBar.css).
const CONTROL_WIDTH_PX = 340;

/**
 * The chat composer can be pinned to the bottom edge, where the voice control floats (always on a
 * phone). Returns how far above the bottom the control must sit to clear it (0 when it is clear).
 */
export function useComposerClearance(): number {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [clearance, setClearance] = useState(0);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the composer's size and the visual viewport (keyboard), which React does not own
  useEffect(() => {
    if (onSettings(pathname)) return;
    const narrow = window.matchMedia("(max-width: 640px)");
    let observed: Element | null = null;
    let stopObserving = () => {};
    function measure() {
      const form = document.querySelector(COMPOSER);
      if (form !== observed) {
        stopObserving();
        stopObserving = form === null ? () => {} : observeResize(form, measure);
        observed = form;
      }
      if (form === null) return setClearance(0);
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const rect = form.getBoundingClientRect();
      const pinned = rect.bottom > viewport - 80;
      // On a wide screen the control sits in the bottom-right corner, clear of a centered composer.
      const overlaps = narrow.matches || rect.right > window.innerWidth - CONTROL_WIDTH_PX;
      setClearance(pinned && overlaps ? Math.ceil(viewport - rect.top) + GAP_PX : 0);
    }
    // The composer mounts a moment after the route changes.
    const timers = [0, 400, 1_500].map((delay) => window.setTimeout(measure, delay));
    narrow.addEventListener("change", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      stopObserving();
      narrow.removeEventListener("change", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [pathname]);

  return onSettings(pathname) ? 0 : clearance;
}

// Settings pages have no chat composer to clear.
const onSettings = (pathname: string) => pathname.startsWith("/settings");
