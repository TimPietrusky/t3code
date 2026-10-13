import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { syncThemeCssReferenceDocs, THEME_CSS_PARTS } from "./themeCssReference";

const repoRoot = NodePath.join(import.meta.dirname, "..", "..", "..");

describe("theme CSS reference", () => {
  it("is what the user guide shows (run node scripts/sync-theme-css-docs.ts)", () => {
    const doc = NodeFS.readFileSync(NodePath.join(repoRoot, "docs/user/custom-css.md"), "utf8");
    expect(syncThemeCssReferenceDocs(doc)).toBe(doc);
  });

  it("documents each part once, and only parts the web app renders", () => {
    expect(new Set(THEME_CSS_PARTS).size).toBe(THEME_CSS_PARTS.length);
    const rendered = new Set<string>();
    const visit = (directory: string) => {
      for (const entry of NodeFS.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = NodePath.join(directory, entry.name);
        if (entry.isDirectory()) visit(entryPath);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const source = NodeFS.readFileSync(entryPath, "utf8");
          for (const match of source.matchAll(/data-t3-part(?:"\])?[=:]\s*"([a-z-]+)"/g)) {
            rendered.add(match[1]!);
          }
        }
      }
    };
    visit(NodePath.join(repoRoot, "apps/web/src"));
    expect([...rendered].toSorted()).toEqual([...THEME_CSS_PARTS].toSorted());
  });
});
