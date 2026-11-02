import * as NodeModule from "node:module";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Vite config runs before any Effect runtime.
import * as NodePath from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite-plus";

/**
 * The voice page's extras (extras/) as one small ES module for the phone's production build
 * (scripts/t3voice-phone-build.mjs). React comes from the page that loads it (VoiceExtrasSlot sets
 * `globalThis.__t3voiceHost`), so a new build swaps in without a reload and one React runs.
 */
const extrasDir = NodePath.join(import.meta.dirname, "extras");
const HOST_MODULES = new Set(["react", "react/jsx-runtime"]);
const HOST = "\0t3voice-host:";
const require = NodeModule.createRequire(import.meta.url);

function hostModules(): Plugin {
  return {
    name: "t3voice-extras-host",
    enforce: "pre",
    resolveId: (source) => (HOST_MODULES.has(source) ? HOST + source : null),
    load(id) {
      if (id.startsWith(HOST)) {
        const name = id.slice(HOST.length);
        const names = Object.keys(require(name)).filter(
          (key) => key !== "default" && /^[A-Za-z_$][\w$]*$/.test(key),
        );
        return [
          // A namespace of a CommonJS module may carry its names only on `default`.
          `const loaded = globalThis.__t3voiceHost[${JSON.stringify(name)}];`,
          "const host = loaded.default ?? loaded;",
          "export default host;",
          `export const { ${names.join(", ")} } = host;`,
        ].join("\n");
      }
      // A second copy of an app module would be a second app state; the page passes what it needs.
      const file = id.split("?")[0] ?? id;
      if (!id.startsWith("\0") && !file.startsWith(extrasDir + NodePath.sep)) {
        this.error(`voice extras may import only React and files in src/voice/extras: ${file}`);
      }
      return null;
    },
  };
}

export default defineConfig({
  root: NodePath.join(import.meta.dirname, "../.."),
  publicDir: false,
  plugins: [hostModules(), react()],
  build: {
    lib: {
      entry: NodePath.join(extrasDir, "VoiceExtras.tsx"),
      formats: ["es"],
      fileName: () => "extras.js",
      cssFileName: "extras",
    },
    emptyOutDir: true,
  },
});
