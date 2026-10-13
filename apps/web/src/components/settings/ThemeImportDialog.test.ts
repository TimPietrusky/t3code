import { describe, expect, it } from "vite-plus/test";

import { describeOversizedThemeFile, MAX_THEME_FILE_BYTES } from "./ThemeImportDialog";

describe("theme import size guard", () => {
  it("accepts anything a theme file could plausibly be", () => {
    for (const bytes of [0, 4_096, MAX_THEME_FILE_BYTES]) {
      expect(describeOversizedThemeFile(bytes)).toBeNull();
    }
  });

  it("rejects a file too large to be a theme and names its size", () => {
    const message = describeOversizedThemeFile(100 * 1024 * 1024);
    expect(message).toContain("100.0 MB");
    expect(message).toContain("1.3 MB");
  });

  it("leaves room for a theme carrying a full-window photo", () => {
    expect(describeOversizedThemeFile(1024 * 1024)).toBeNull();
    expect(describeOversizedThemeFile(MAX_THEME_FILE_BYTES + 1)).toContain("limit 1.3 MB");
  });
});
