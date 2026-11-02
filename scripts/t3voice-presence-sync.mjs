// Copies Presence's call-frame bar (agent-dashboard/public/presence: markup, bar.css, frame.mjs,
// callwave.mjs and what they import) into apps/web/src/voice/presence, so t3 voice's bar is
// Presence's own code. Two changes only: the HUD's red becomes green, and the CSS is scoped to the
// bar's root ([data-t3voice-presence]) instead of :root. Re-run after Presence's bar changes.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const presence = NodePath.resolve(
  process.env.PRESENCE_PUBLIC ?? `${process.env.HOME}/dev/kale/agent-dashboard/public`,
);
const out = NodePath.resolve(import.meta.dirname, "../apps/web/src/voice/presence");
const ROOT = "[data-t3voice-presence]";

// Presence's red HUD → green. Amber (her voice) and cyan (a thread) stay as they are.
const recolor = (text) =>
  text
    .replace(/255,\s*95,\s*85/g, "61, 255, 143")
    .replace(/255,\s*120,\s*105/g, "120, 255, 170")
    .replace(/#ff5f55/gi, "#3dff8f")
    .replace(/#1b0806/gi, "#04170c");

const read = (path) => NodeFS.readFileSync(NodePath.join(presence, path), "utf8");
const write = (name, text) => NodeFS.writeFileSync(NodePath.join(out, name), text);
const banner = (from) =>
  `// Copied from Presence (agent-dashboard/public/${from}) by scripts/t3voice-presence-sync.mjs; red recoloured green. Do not edit here.\n`;

NodeFS.mkdirSync(NodePath.join(out, "fonts"), { recursive: true });

// The modules, imports pointed at the copies.
const modules = [
  ["presence/frame.mjs", "frame.js"],
  ["presence/callwave.mjs", "callwave.js"],
  ["presence/asciiline.mjs", "asciiline.js"],
  ["shared/wave.mjs", "wave.js"],
  ["shared/speech.mjs", "speech-constants.js"],
];
for (const [from, to] of modules) {
  const text = recolor(read(from))
    .replace(/from "\.\.\/shared\/wave\.mjs"/g, 'from "./wave.js"')
    .replace(/from "\.\/asciiline\.mjs"/g, 'from "./asciiline.js"')
    .replace(/from "\.\/speech\.mjs"/g, 'from "./speech-constants.js"');
  write(to, banner(from) + text);
}

// Fonts the bar uses (SIL Open Font License 1.1).
const fonts = [
  ["Oxanium", "200 800", "oxanium-var-latin.woff2"],
  ["Rajdhani", "700", "rajdhani-700-latin.woff2"],
  ["Geist", "400", "geist-400-latin.woff2"],
  ["Geist", "600", "geist-600-latin.woff2"],
  ["Geist Mono", "400", "geist-mono-400-latin.woff2"],
];
for (const [, , file] of fonts) {
  NodeFS.copyFileSync(
    NodePath.join(presence, "shared/fonts", file),
    NodePath.join(out, "fonts", file),
  );
}
const fontFaces = fonts
  .map(
    ([family, weight, file]) =>
      `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url("./fonts/${file}") format("woff2"); }`,
  )
  .join("\n");

// The CSS: Presence's tokens and bar, scoped to the bar's root.
const scope = (css) =>
  css
    .replace(/:root\s*\{/g, `${ROOT} {`)
    .replace(
      /^\* \{ box-sizing: border-box; \}$/m,
      `${ROOT}, ${ROOT} *, ${ROOT} *::before, ${ROOT} *::after { box-sizing: border-box; }`,
    )
    .replace(/^html, body \{[^}]*\}$/m, "")
    .replace(
      /^body\.p2 \{[^}]*\}$/m,
      `${ROOT} { color: var(--color-ink); font: var(--weight-regular) var(--text-md)/var(--leading-body) var(--font-sans); -webkit-font-smoothing: antialiased; }`,
    )
    .replace(/:where\(\.p2\)/g, `:where(${ROOT})`)
    .replace(/^\[hidden\] \{/m, `${ROOT} [hidden] {`);
write(
  "presence.css",
  `/* Copied from Presence (agent-dashboard/public/presence/ions.css, bar.css) by scripts/t3voice-presence-sync.mjs:
   red recoloured green, scoped to ${ROOT}. Do not edit here. */
${fontFaces}
${scope(recolor(read("presence/ions.css")))}
${scope(recolor(read("presence/bar.css")))}
`,
);

// The markup: Presence's footer (the call frame and its rail), without the conversation, the
// write panel and the typing field, plus one slot tab for small controls (t3 voice's own).
const html = read("presence/index.html");
let footer = html.slice(html.indexOf('<footer class="bar"'), html.indexOf("</footer>") + 9);
footer = footer
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<section class="convo"[\s\S]*?<\/section>/, "")
  .replace(/<div class="bar-up"[^>]*><\/div>/, "")
  .replace(/<div class="bar-prompt"[^>]*><\/div>/, "")
  .replace('<div class="fr-tmr"', '<div class="fr-slot" data-slot></div><div class="fr-tmr"')
  .replace(/\n\s*\n/g, "\n");
const keyboard =
  '<svg class="a-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/></svg>';
footer = footer.replace(/(<button class="bar-type"[^>]*>)(<\/button>)/, `$1${keyboard}$2`);
write(
  "markup.js",
  `${banner("presence/index.html")}export const BAR_HTML = ${JSON.stringify(recolor(footer))};\n`,
);

console.log(`synced Presence's bar from ${presence} into ${NodePath.relative(process.cwd(), out)}`);
