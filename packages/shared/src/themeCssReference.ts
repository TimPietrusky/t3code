/**
 * The theme CSS contract: the `data-t3-part` hooks themes may target and the
 * rules for restyling around them. The single source for the user guide's
 * reference (docs/user/custom-css.md, kept in sync by
 * `node scripts/sync-theme-css-docs.ts`) and for the theme guide agents read
 * through the T3 Code MCP server, so the two cannot drift.
 */

export type ThemeCssPartEntry = Readonly<{
  /** The parts this entry documents, in the order the text names them. */
  parts: ReadonlyArray<string>;
  /** Markdown: what the part is, starting with the part name in backticks. */
  text: string;
  /** A short, copy-pasteable example. */
  css: string;
}>;

export type ThemeCssPartGroup = Readonly<{
  title: string;
  /** Markdown shown before the group's entries. */
  note?: string;
  entries: ReadonlyArray<ThemeCssPartEntry>;
}>;

export const THEME_CSS_RULES_MARKDOWN =
  "Target the `data-t3-part` attributes listed below. They are kept stable across releases; class\nnames and the rest of the markup are not, so selectors built on them break without notice.\n\nSafe to change: colors, borders, radius, shadows, typography, spacing inside a part, hiding small\nparts, and the order of items within a row.\n\nKeep the global layout as it is: the app shell, the sidebar's width and position, the main area,\nthe right panel, and the terminal drawer are sized by the app. Moving or resizing them can hide\ncontrols or break resizing. Avoid animations that run continuously; they keep the GPU busy.\n\nYour rules already beat the built-in utility classes. You only need `!important` for the rare\nbuilt-in rule that is itself marked important.";

export const THEME_CSS_PARTS_INTRO_MARKDOWN =
  'In the default sidebar, `thread-item` and `thread-row` also carry `data-t3-variant`: `card` for\nactive threads and `slim` for settled ones. The open thread\'s row has `aria-current="page"`.';

export const THEME_CSS_PART_GROUPS: ReadonlyArray<ThemeCssPartGroup> = [
  {
    title: "Shell",
    entries: [
      {
        parts: ["app-shell"],
        text: "`app-shell` wraps the whole window, sidebar and main area.",
        css: '[data-t3-part="app-shell"] {\n  accent-color: var(--app-theme-accent);\n}',
      },
      {
        parts: ["main"],
        text: "`main` is the area next to the sidebar on each page.",
        css: '[data-t3-part="main"] {\n  background: var(--app-theme-canvas);\n}',
      },
      {
        parts: ["sidebar"],
        text: "`sidebar` is the left sidebar's panel.",
        css: '[data-t3-part="sidebar"] {\n  font-family: "Iowan Old Style", serif;\n}',
      },
      {
        parts: ["sidebar-header"],
        text: "`sidebar-header` is the top row with the app name and window controls.",
        css: '[data-t3-part="sidebar-header"] {\n  border-bottom: 1px solid var(--app-theme-sidebar-border);\n}',
      },
      {
        parts: ["sidebar-toolbar"],
        text: "`sidebar-toolbar` is the search and new-thread row in the default sidebar.",
        css: '[data-t3-part="sidebar-toolbar"] {\n  padding-block: 4px;\n}',
      },
      {
        parts: ["sidebar-content"],
        text: "`sidebar-content` is the scrolling thread list.",
        css: '[data-t3-part="sidebar-content"] {\n  scrollbar-width: thin;\n}',
      },
      {
        parts: ["sidebar-section-header"],
        text: "`sidebar-section-header` is a shelf heading such as Snoozed or Settled.",
        css: '[data-t3-part="sidebar-section-header"] {\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n}',
      },
      {
        parts: ["sidebar-footer"],
        text: "`sidebar-footer` holds the settings menu and update notices.",
        css: '[data-t3-part="sidebar-footer"] {\n  opacity: 0.7;\n}',
      },
    ],
  },
  {
    title: "Projects",
    note: "`project-group`, `project-group-header` and `project-group-threads` appear in the legacy sidebar\n(**Settings → General → Legacy features**), which groups threads under their project. Hiding a\ngroup header also hides its collapse control.",
    entries: [
      {
        parts: ["project-group"],
        text: "`project-group` is one project with its threads.",
        css: '[data-t3-part="project-group"] {\n  margin-bottom: 8px;\n}',
      },
      {
        parts: ["project-group-header"],
        text: "`project-group-header` is the project's own row.",
        css: '[data-t3-part="project-group-header"] {\n  display: none;\n}',
      },
      {
        parts: ["project-group-threads"],
        text: "`project-group-threads` is the list of threads under a project.",
        css: '[data-t3-part="project-group-threads"] {\n  border-left: 0;\n  margin-inline: 0;\n}',
      },
      {
        parts: ["project-icon"],
        text: "`project-icon` is a project's icon in the sidebar, in group headers and thread rows. Style the\nicon itself through its child.",
        css: '[data-t3-part="sidebar"] [data-t3-part="project-icon"] {\n  display: none;\n}\n[data-t3-part="project-icon"] > * {\n  border-radius: 999px;\n}',
      },
      {
        parts: ["project-name"],
        text: "`project-name` is a project's visible name in a group header or a thread row.",
        css: '[data-t3-part="project-name"] {\n  color: var(--app-theme-accent);\n}',
      },
    ],
  },
  {
    title: "Threads",
    entries: [
      {
        parts: ["thread-item"],
        text: "`thread-item` is the list item around a row; use it for space between rows.",
        css: '[data-t3-part="thread-item"] {\n  padding-block: 4px;\n}',
      },
      {
        parts: ["thread-row"],
        text: "`thread-row` is the clickable row. It is positioned, so children can be placed against it.",
        css: '[data-t3-part="thread-row"] {\n  border-radius: 14px;\n  border: 1px solid var(--app-theme-border);\n}',
      },
      {
        parts: ["thread-body"],
        text: "`thread-body` is the row's content. Active rows have a fixed height; let them grow with:",
        css: '[data-t3-part="thread-body"] {\n  height: auto;\n}',
      },
      {
        parts: ["thread-header"],
        text: "`thread-header` is the top line of an active row: project, pin and status.",
        css: '[data-t3-part="thread-header"] {\n  flex-direction: row-reverse;\n}',
      },
      {
        parts: ["thread-title"],
        text: "`thread-title` is the thread's title.",
        css: '[data-t3-part="thread-title"] {\n  white-space: normal;\n  overflow: visible;\n  text-overflow: clip;\n  font-size: 15px;\n}',
      },
      {
        parts: ["thread-status"],
        text: "`thread-status` is the status or time slot, with its hover actions.",
        css: '[data-t3-part="thread-status"] {\n  order: -1;\n}',
      },
      {
        parts: ["thread-meta"],
        text: "`thread-meta` is the branch, pull request and change summary line of an active row.",
        css: '[data-t3-part="thread-meta"] {\n  display: none;\n}',
      },
      {
        parts: ["thread-project"],
        text: "`thread-project` is the thread's project name, hidden until a theme shows it. It sits directly\ninside `thread-row`, so it can be shown inline or placed on the row.",
        css: '[data-t3-part="thread-project"] {\n  display: inline-block;\n  position: absolute;\n  top: 4px;\n  right: 8px;\n  padding: 0 6px;\n  border-radius: 999px;\n  background: var(--app-theme-accent);\n  color: var(--app-theme-accent-foreground);\n  font-size: 10px;\n}',
      },
    ],
  },
  {
    title: "Chat",
    entries: [
      {
        parts: ["chat-header"],
        text: "`chat-header` is the bar above the conversation.",
        css: '[data-t3-part="chat-header"] {\n  box-shadow: 0 1px 0 var(--app-theme-border);\n}',
      },
      {
        parts: ["transcript"],
        text: "`transcript` is the scrolling conversation.",
        css: '[data-t3-part="transcript"] {\n  font-size: 15px;\n}',
      },
      {
        parts: ["user-message", "user-message-bubble"],
        text: "`user-message` is one of your messages, and `user-message-bubble` its bubble.",
        css: '[data-t3-part="user-message-bubble"] {\n  border-radius: 20px 20px 4px 20px;\n}',
      },
      {
        parts: ["assistant-message"],
        text: "`assistant-message` is one agent reply.",
        css: '[data-t3-part="assistant-message"] {\n  line-height: 1.7;\n}',
      },
      {
        parts: ["composer", "composer-toolbar"],
        text: "`composer` is the message box, and `composer-toolbar` its row of controls.",
        css: '[data-t3-part="composer"] {\n  filter: drop-shadow(0 8px 16px rgb(0 0 0 / 0.08));\n}\n[data-t3-part="composer-toolbar"] {\n  gap: 12px;\n}',
      },
    ],
  },
  {
    title: "Panels",
    entries: [
      {
        parts: ["right-panel"],
        text: "`right-panel` is the side panel for diffs, previews and other tabs.",
        css: '[data-t3-part="right-panel"] {\n  border-left-color: var(--app-theme-accent);\n}',
      },
      {
        parts: ["terminal-drawer"],
        text: "`terminal-drawer` is the terminal, in the drawer or the right panel.",
        css: '[data-t3-part="terminal-drawer"] {\n  border-top: 2px solid var(--app-theme-accent);\n}',
      },
      {
        parts: ["settings"],
        text: "`settings` is the settings page next to its navigation.",
        css: '[data-t3-part="settings"] {\n  font-size: 15px;\n}',
      },
    ],
  },
];

/** Every part name, in reference order. */
export const THEME_CSS_PARTS: ReadonlyArray<string> = THEME_CSS_PART_GROUPS.flatMap((group) =>
  group.entries.flatMap((entry) => entry.parts),
);

/** The guide's "Parts" section body, as the user guide renders it. */
export function renderThemeCssPartsMarkdown(headingLevel = 3): string {
  const heading = "#".repeat(headingLevel);
  const sections = THEME_CSS_PART_GROUPS.map((group) =>
    [
      `${heading} ${group.title}`,
      ...(group.note ? [group.note] : []),
      ...group.entries.map((entry) => `${entry.text}\n\n\`\`\`css\n${entry.css}\n\`\`\``),
    ].join("\n\n"),
  );
  return [THEME_CSS_PARTS_INTRO_MARKDOWN, ...sections].join("\n\n");
}

const GENERATED_SECTIONS = {
  "theme-css-rules": () => THEME_CSS_RULES_MARKDOWN,
  "theme-css-parts": () => renderThemeCssPartsMarkdown(),
} as const;

/**
 * Rewrites the generated sections of the user guide, each between
 * `<!-- generated:NAME -->` and `<!-- /generated:NAME -->`, from this module.
 */
export function syncThemeCssReferenceDocs(doc: string): string {
  let next = doc;
  for (const [name, render] of Object.entries(GENERATED_SECTIONS)) {
    const start = `<!-- generated:${name} -->`;
    const end = `<!-- /generated:${name} -->`;
    const from = next.indexOf(start);
    const to = next.indexOf(end);
    if (from === -1 || to < from) throw new Error(`Missing generated section "${name}".`);
    next = `${next.slice(0, from + start.length)}\n\n${render()}\n\n${next.slice(to)}`;
  }
  return next;
}
