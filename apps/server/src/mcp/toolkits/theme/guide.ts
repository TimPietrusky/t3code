import {
  MAX_THEME_ASSET_COUNT,
  MAX_THEME_ASSETS_LENGTH,
  MAX_THEME_CSS_LENGTH,
} from "@t3tools/contracts";
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
      "- `assets` is optional: images, name to base64 data URI (see Images).",
    ].join("\n"),
    "## Images",
    [
      "A theme can carry real photos and artwork. Images live inside the theme, so they work offline, in the desktop app (which blocks remote stylesheets and fonts) and on every client the theme reaches.",
      "",
      `1. Get the image onto this machine and make it background-sized: about 2400px wide as WebP or JPEG, a few hundred KB (\`sips\`, \`cwebp\` or \`ffmpeg\` work). Use images you may use: your own, public domain (NASA) or CC0.`,
      '2. Pass it to `t3_theme_write` as `assetFiles: { "photo": "/absolute/path/photo.webp" }`. The server reads and embeds it; do not paste base64 yourself.',
      "3. Each image becomes a CSS variable holding a `url()`: `photo` is `var(--t3-asset-photo)`.",
      "",
      "```css",
      '[data-t3-part="app-shell"] {',
      "  background: var(--t3-asset-photo) center / cover no-repeat fixed;",
      "}",
      "/* Clear the main area and sidebar surfaces so the photo shows through. */",
      '[data-t3-part="main"] {',
      "  --app-theme-canvas: transparent;",
      "}",
      '[data-t3-part="sidebar"] {',
      "  --app-theme-sidebar: transparent;",
      "  background: rgb(255 255 255 / 0.7);",
      "  backdrop-filter: blur(18px);",
      "}",
      "```",
      "",
      `- Up to ${MAX_THEME_ASSET_COUNT} images and ${Math.round(MAX_THEME_ASSETS_LENGTH / 1024).toLocaleString("en-US")} KB of data URIs per theme (about ${Math.round((MAX_THEME_ASSETS_LENGTH * 3) / 4 / 1024).toLocaleString("en-US")} KB of image files). Names are lowercase letters, digits and hyphens, starting with a letter.`,
      "- `t3_theme_read` lists a theme's images by name and size but leaves out their data. `t3_theme_write` keeps the existing images unless you give `theme.assets` (`{}` removes them all); `assetFiles` adds or replaces single images on top.",
      "- Setting `--app-theme-canvas` on `main` or `--app-theme-sidebar` on `sidebar` changes only that region's surface; `transparent` reveals the app-shell background.",
      "- Keep text readable over a photo: give messages and the sidebar translucent backgrounds (about 80-90% opaque behind text), or darken the photo with a gradient in the same `background` (e.g. `linear-gradient(rgb(0 0 0 / 0.4), rgb(0 0 0 / 0.4)), var(--t3-asset-photo)`). `backdrop-filter` blurs the sidebar and header but not inside the transcript, so message backgrounds need the higher opacity.",
      "- Keep big shadows off messages: rows clip them, which leaves a hard-edged band under the message.",
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
