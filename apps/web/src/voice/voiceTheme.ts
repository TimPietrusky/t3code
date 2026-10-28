import type { ThemeAppearance, ThemeColors } from "../themePalette";

/**
 * The voice brain's theme. When set, it is painted over the selected theme in this dev client
 * only: `colors` overrides any of T3's color roles (see THEME_COLOR_ROLES), starting from the
 * built-in T3 Code palette for `appearance`. `null` keeps the user's normal theme.
 */
export type VoiceTheme = {
  readonly appearance: ThemeAppearance;
  readonly colors: Partial<ThemeColors>;
};

export const voiceTheme: VoiceTheme | null = null;
