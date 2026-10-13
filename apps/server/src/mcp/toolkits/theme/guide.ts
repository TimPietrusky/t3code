import { MAX_THEME_CSS_LENGTH } from "@t3tools/contracts";
import {
  renderThemeCssPartsMarkdown,
  THEME_CSS_RULES_MARKDOWN,
} from "@t3tools/shared/themeCssReference";
import { THEME_COLOR_ROLES } from "@t3tools/shared/themePalettes";

import { MAX_THEME_FILE_BYTES } from "../../../environmentTheme.ts";

const cssVariable = (role: string) =>
  role === "terminalSelection"
    ? "--app-theme-terminal-selection-background"
    : `--app-theme-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/** What t3_theme_guide returns: the theme format plus the user guide's CSS reference. */
export const themeGuideMarkdown = (): string =>
  [
    "# Restyling T3 Code",
    [
      "1. `t3_theme_list` shows what exists; `t3_theme_read` returns a theme to start from.",
      "2. `t3_theme_write` publishes a theme under an id of your choice (not a built-in id).",
      "3. `t3_theme_set` switches every connected web and desktop client to it. Rewriting the theme they show later retints them live, palette and CSS alike.",
      "Mobile clients keep their own appearance and ignore custom CSS.",
    ].join("\n"),
    "## Theme format",
    [
      "Short form, the easiest: the rest of the palette is generated from two seeds.",
      "",
      "```json",
      '{ "name": "Mint", "appearance": "light", "canvas": "#f2fbf6", "accent": "#1f9d6b", "css": "..." }',
      "```",
      "",
      "- `name` (48 characters max) and `appearance` (`light` or `dark`) are required.",
      "- `canvas` and `accent` are 3- or 6-digit hex colors for that appearance.",
      "- `colors` overrides individual roles (any CSS color); without seeds it is the whole palette.",
      '- `variants` adds the other appearance as a colors object, e.g. `{ "dark": { "canvas": "#0f1a14", "accent": "#5fd3a1", ... } }`. Variants are not generated from seeds, so give a full dark palette (at least canvas, text, surface, sidebar, accent and border roles) or the rest falls back to the stock dark colors.',
      `- \`css\` is optional, up to ${MAX_THEME_CSS_LENGTH.toLocaleString("en-US")} characters, applied in both appearances; scope dark-only rules with \`:root.dark\`. The whole file is limited to ${MAX_THEME_FILE_BYTES.toLocaleString("en-US")} bytes.`,
    ].join("\n"),
    "## Color roles",
    [
      "Each role is also a CSS variable for your css, e.g. `accent` is `var(--app-theme-accent)`:",
      "",
      THEME_COLOR_ROLES.map((role) => `\`${role}\` (\`${cssVariable(role)}\`)`).join(", "),
    ].join("\n"),
    "## Custom CSS",
    THEME_CSS_RULES_MARKDOWN,
    "## Parts",
    renderThemeCssPartsMarkdown(3),
  ].join("\n\n");
