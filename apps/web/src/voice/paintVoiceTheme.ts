import {
  T3_CODE_DARK_THEME_COLORS,
  T3_CODE_LIGHT_THEME_COLORS,
} from "@t3tools/shared/themePalettes";

import { refreshTheme, syncBrowserChromeTheme } from "~/hooks/useTheme";
import { applyThemeColorPreview } from "../themePalette";
import { type VoiceTheme, voiceTheme } from "./voiceTheme";

let painted = false;

function paint(theme: VoiceTheme | null): void {
  if (theme === null) {
    if (painted) refreshTheme();
    painted = false;
    return;
  }
  const base = theme.appearance === "dark" ? T3_CODE_DARK_THEME_COLORS : T3_CODE_LIGHT_THEME_COLORS;
  applyThemeColorPreview({ ...base, ...theme.colors }, theme.appearance);
  syncBrowserChromeTheme();
  painted = true;
}

/** Paints `voiceTheme.ts` over the selected theme; returns the way back to the user's theme. */
export function paintVoiceTheme(): () => void {
  paint(voiceTheme);
  return () => paint(null);
}

// The brain edits voiceTheme.ts while the page is open; repaint in place instead of reloading.
if (import.meta.hot) {
  import.meta.hot.accept("./voiceTheme", (next) => {
    paint((next as { voiceTheme?: VoiceTheme | null } | undefined)?.voiceTheme ?? null);
  });
}
