// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - a tiny standalone docs generator.
// Regenerates the data-t3-part reference in docs/user/custom-css.md from
// packages/shared/src/themeCssReference.ts. `--check` fails instead of writing.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { syncThemeCssReferenceDocs } from "@t3tools/shared/themeCssReference";

const docPath = NodePath.join(import.meta.dirname, "..", "docs", "user", "custom-css.md");
const current = NodeFS.readFileSync(docPath, "utf8");
const next = syncThemeCssReferenceDocs(current);
if (process.argv.includes("--check")) {
  if (next !== current) {
    console.error(`${docPath} is out of date. Run: node scripts/sync-theme-css-docs.ts`);
    process.exit(1);
  }
} else if (next !== current) {
  NodeFS.writeFileSync(docPath, next);
}
