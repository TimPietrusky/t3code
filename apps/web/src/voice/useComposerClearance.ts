import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { observeResize } from "~/lib/observeResize";

const COMPOSER = 'form[data-chat-composer-form="true"]';
const GAP_PX = 8;

/** Where the chat composer is: the column the voice control lines up with. */
export type ComposerPlace = {
  /** How far above the bottom the control must sit to clear a pinned composer (0 when clear). */
  readonly clearance: number;
  /** The composer's column (viewport px), or null where there is no composer (settings, canvas). */
  readonly column: { readonly left: number; readonly width: number } | null;
};

const NONE: ComposerPlace = { clearance: 0, column: null };

const same = (a: ComposerPlace, b: ComposerPlace) =>
  a.clearance === b.clearance &&
  a.column?.left === b.column?.left &&
  a.column?.width === b.column?.width;

/**
 * The chat composer can be pinned to the bottom edge, where the voice control floats (always on a
 * phone). Returns how far above the bottom the control must sit to clear it, and the composer's
 * column so the control takes the same left and right edges (Presence centres its bar on the
 * viewport; T3's column is centred in the main pane beside the sidebar, at the chat-width setting).
 */
export function useComposerClearance(): ComposerPlace {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [place, setPlace] = useState<ComposerPlace>(NONE);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the composer's box and the visual viewport (keyboard), which React does not own
  useEffect(() => {
    if (onSettings(pathname)) return;
    let observed: Element | null = null;
    let stopObserving = () => {};
    const update = (next: ComposerPlace) =>
      setPlace((current) => (same(current, next) ? current : next));
    function measure() {
      const form = document.querySelector(COMPOSER);
      if (form !== observed) {
        stopObserving();
        // The column moves without the form resizing when anything around it does (the sidebar
        // opening, the window, a scrollbar), so every box from the form up is watched.
        stopObserving = form === null ? () => {} : observeResize(boxesUp(form), measure);
        observed = form;
      }
      if (form === null) return update(NONE);
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const rect = form.getBoundingClientRect();
      // The control spans the composer's column, so a composer pinned to the bottom is under it.
      const pinned = rect.bottom > viewport - 80;
      update({
        clearance: pinned ? Math.ceil(viewport - rect.top) + GAP_PX : 0,
        column: rect.width > 0 ? { left: rect.left, width: rect.width } : null,
      });
    }
    // The composer mounts a moment after the route changes.
    const timers = [0, 400, 1_500].map((delay) => window.setTimeout(measure, delay));
    // The sidebar slides with a transform on some layouts; its transition's end settles the column.
    document.addEventListener("transitionend", measure);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      stopObserving();
      document.removeEventListener("transitionend", measure);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [pathname]);

  return onSettings(pathname) ? NONE : place;
}

const boxesUp = (element: Element): Element[] => {
  const boxes: Element[] = [];
  for (let at: Element | null = element; at !== null; at = at.parentElement) boxes.push(at);
  return boxes;
};

// Settings pages have no chat composer to clear.
const onSettings = (pathname: string) => pathname.startsWith("/settings");
