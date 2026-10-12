import { MAX_THEME_CSS_LENGTH } from "@t3tools/contracts";
import type { KeyboardEvent } from "react";

import { cn } from "../../lib/utils";

const CSS_PLACEHOLDER = `/* Applied while this theme is active. Target stable parts: */
[data-t3-part="thread-title"] {
  white-space: normal;
}`;

const INDENT = "  ";

/**
 * Plain code surface for a theme's stylesheet. Tab indents instead of moving
 * focus so CSS can be typed naturally; Escape still leaves the field.
 */
export function ThemeCssEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const isOverLimit = value.length > MAX_THEME_CSS_LENGTH;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    event.preventDefault();
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd } = textarea;
    const next = `${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = selectionStart + INDENT.length;
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-xl border border-input bg-background shadow-xs/5 focus-within:border-ring focus-within:ring-3 focus-within:ring-inset focus-within:ring-ring/24">
        <textarea
          aria-invalid={isOverLimit || undefined}
          aria-label="Theme CSS"
          className="block min-h-64 w-full resize-y overflow-auto bg-transparent p-3 font-mono text-xs leading-5 text-foreground caret-foreground outline-none placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground"
          data-testid="theme-css-editor"
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={CSS_PLACEHOLDER}
          spellCheck={false}
          value={value}
          wrap="off"
        />
      </div>
      <p
        className={cn(
          "flex justify-between gap-3 text-xs",
          isOverLimit ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <span>Previews live. Applies in light and dark; scope with :root.dark.</span>
        <span className="shrink-0 tabular-nums">
          {value.length.toLocaleString()} / {MAX_THEME_CSS_LENGTH.toLocaleString()}
        </span>
      </p>
    </div>
  );
}
