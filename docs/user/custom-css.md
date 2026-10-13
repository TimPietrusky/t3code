# Custom CSS in themes

On web and desktop, a theme can carry its own CSS. While the theme is active, T3 Code adds that
CSS after its own styles, so your rules win over the built-in look. Switching to another theme
removes it. Mobile ignores theme CSS.

## Add CSS to a theme

- **Theme editor:** open **Settings → Appearance**, edit or create a theme, and switch to the
  **CSS** tab. Changes preview on the live app as you type; saving the theme keeps them. Exported theme
  files include the CSS, and importing a file brings it back.
- **Theme file:** add a `css` string to an exported theme file or a published theme in
  `~/.t3/userdata/themes/` (see [Publish a theme](./appearance.md#publish-a-theme)).
- **Ask your agent:** see [Ask your agent](./appearance.md#ask-your-agent).

```json
{
  "version": 1,
  "name": "Rosy",
  "appearance": "light",
  "colors": { "canvas": "#fff5f8", "accent": "#e8437f" },
  "css": "[data-t3-part=\"thread-title\"] { font-weight: 700; }"
}
```

The [Pink Love example](./themes/pink-love.json) is a complete theme with light and dark palettes
and sidebar CSS. Import it in **Settings → Appearance**, or copy it into your themes folder.

Theme CSS is limited to 16 KB. The same CSS applies in light and dark mode; scope a rule to one
appearance with `:root.dark` or `:root:not(.dark)`. Use the palette's color variables, such as
`var(--app-theme-accent)`, so the CSS follows the light and dark palettes.

## What to change

<!-- generated:theme-css-rules -->

Target the `data-t3-part` attributes listed below. They are kept stable across releases; class
names and the rest of the markup are not, so selectors built on them break without notice.

Safe to change: colors, borders, radius, shadows, typography, spacing inside a part, hiding small
parts, and the order of items within a row.

Keep the global layout as it is: the app shell, the sidebar's width and position, the main area,
the right panel, and the terminal drawer are sized by the app. Moving or resizing them can hide
controls or break resizing. Avoid animations that run continuously; they keep the GPU busy.

Your rules already beat the built-in utility classes. You only need `!important` for the rare
built-in rule that is itself marked important.

Keep everything in the theme: the desktop app does not load stylesheets or fonts from other
sites, so `@import` and web fonts by URL are ignored there. Use fonts installed on the computer.

<!-- /generated:theme-css-rules -->

## Parts

<!-- generated:theme-css-parts -->

In the default sidebar, `thread-item` and `thread-row` also carry `data-t3-variant`: `card` for
active threads and `slim` for settled ones. The open thread's row has `aria-current="page"`.

### Shell

`app-shell` wraps the whole window, sidebar and main area.

```css
[data-t3-part="app-shell"] {
  accent-color: var(--app-theme-accent);
}
```

`main` is the area next to the sidebar on each page.

```css
[data-t3-part="main"] {
  background: var(--app-theme-canvas);
}
```

`sidebar` is the left sidebar's panel.

```css
[data-t3-part="sidebar"] {
  font-family: "Iowan Old Style", serif;
}
```

`sidebar-header` is the top row with the app name and window controls.

```css
[data-t3-part="sidebar-header"] {
  border-bottom: 1px solid var(--app-theme-sidebar-border);
}
```

`sidebar-toolbar` is the search and new-thread row in the default sidebar.

```css
[data-t3-part="sidebar-toolbar"] {
  padding-block: 4px;
}
```

`sidebar-content` is the scrolling thread list.

```css
[data-t3-part="sidebar-content"] {
  scrollbar-width: thin;
}
```

`sidebar-section-header` is a shelf heading such as Snoozed or Settled.

```css
[data-t3-part="sidebar-section-header"] {
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
```

`sidebar-footer` holds the settings menu and update notices.

```css
[data-t3-part="sidebar-footer"] {
  opacity: 0.7;
}
```

### Projects

`project-group`, `project-group-header` and `project-group-threads` appear in the legacy sidebar
(**Settings → General → Legacy features**), which groups threads under their project. Hiding a
group header also hides its collapse control.

`project-group` is one project with its threads.

```css
[data-t3-part="project-group"] {
  margin-bottom: 8px;
}
```

`project-group-header` is the project's own row.

```css
[data-t3-part="project-group-header"] {
  display: none;
}
```

`project-group-threads` is the list of threads under a project.

```css
[data-t3-part="project-group-threads"] {
  border-left: 0;
  margin-inline: 0;
}
```

`project-icon` is a project's icon in the sidebar, in group headers and thread rows. Style the
icon itself through its child.

```css
[data-t3-part="sidebar"] [data-t3-part="project-icon"] {
  display: none;
}
[data-t3-part="project-icon"] > * {
  border-radius: 999px;
}
```

`project-name` is a project's visible name in a group header or a thread row.

```css
[data-t3-part="project-name"] {
  color: var(--app-theme-accent);
}
```

### Threads

`thread-item` is the list item around a row; use it for space between rows.

```css
[data-t3-part="thread-item"] {
  padding-block: 4px;
}
```

`thread-row` is the clickable row. It is positioned, so children can be placed against it.

```css
[data-t3-part="thread-row"] {
  border-radius: 14px;
  border: 1px solid var(--app-theme-border);
}
```

`thread-body` is the row's content. Active rows have a fixed height; let them grow with:

```css
[data-t3-part="thread-body"] {
  height: auto;
}
```

`thread-header` is the top line of an active row: project, pin and status.

```css
[data-t3-part="thread-header"] {
  flex-direction: row-reverse;
}
```

`thread-title` is the thread's title.

```css
[data-t3-part="thread-title"] {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  font-size: 15px;
}
```

`thread-status` is the status or time slot, with its hover actions.

```css
[data-t3-part="thread-status"] {
  order: -1;
}
```

`thread-meta` is the branch, pull request and change summary line of an active row.

```css
[data-t3-part="thread-meta"] {
  display: none;
}
```

`thread-project` is the thread's project name, hidden until a theme shows it. It sits directly
inside `thread-row`, so it can be shown inline or placed on the row.

```css
[data-t3-part="thread-project"] {
  display: inline-block;
  position: absolute;
  top: 4px;
  right: 8px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--app-theme-accent);
  color: var(--app-theme-accent-foreground);
  font-size: 10px;
}
```

### Chat

`chat-header` is the bar above the conversation.

```css
[data-t3-part="chat-header"] {
  box-shadow: 0 1px 0 var(--app-theme-border);
}
```

`transcript` is the scrolling conversation.

```css
[data-t3-part="transcript"] {
  font-size: 15px;
}
```

`user-message` is one of your messages, and `user-message-bubble` its bubble.

```css
[data-t3-part="user-message-bubble"] {
  border-radius: 20px 20px 4px 20px;
}
```

`assistant-message` is one agent reply.

```css
[data-t3-part="assistant-message"] {
  line-height: 1.7;
}
```

`composer` is the message box, and `composer-toolbar` its row of controls.

```css
[data-t3-part="composer"] {
  filter: drop-shadow(0 8px 16px rgb(0 0 0 / 0.08));
}
[data-t3-part="composer-toolbar"] {
  gap: 12px;
}
```

### Panels

`right-panel` is the side panel for diffs, previews and other tabs.

```css
[data-t3-part="right-panel"] {
  border-left-color: var(--app-theme-accent);
}
```

`terminal-drawer` is the terminal, in the drawer or the right panel.

```css
[data-t3-part="terminal-drawer"] {
  border-top: 2px solid var(--app-theme-accent);
}
```

`settings` is the settings page next to its navigation.

```css
[data-t3-part="settings"] {
  font-size: 15px;
}
```

<!-- /generated:theme-css-parts -->
