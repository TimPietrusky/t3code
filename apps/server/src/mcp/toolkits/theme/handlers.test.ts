import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import {
  EnvironmentId,
  MAX_THEME_CSS_LENGTH,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import { THEME_CSS_PARTS } from "@t3tools/shared/themeCssReference";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import * as ServerConfig from "../../../config.ts";
import * as Environment from "../../../environment/ServerEnvironment.ts";
import * as EnvironmentTheme from "../../../environmentTheme.ts";
import * as ThreadCommandExecutor from "../../../orchestration-v2/ThreadCommandExecutor.ts";
import * as ThreadManagement from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { liveThreadShell } from "../../McpToolAccess.testkit.ts";
import * as ThemeHandlers from "./handlers.ts";
import { ThemeToolkit } from "./tools.ts";

const environmentId = EnvironmentId.make("environment:theme");
const threadId = ThreadId.make("thread:theme");

const MINT = {
  name: "Mint",
  appearance: "light",
  canvas: "#f2fbf6",
  accent: "#1f9d6b",
  css: '[data-t3-part="thread-title"] { font-size: 12px; }',
} as const;

/**
 * Runs `body` against the real theme service on a fresh state directory, with
 * a thread caller whose run is live unless `activeRunId` says otherwise.
 */
const withThemeTools = <A, E, R>(
  body: Effect.Effect<A, E, R>,
  options: { readonly activeRunId?: null } = {},
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3code-theme-tools-" });
    const layerDependencies = Layer.mergeAll(
      ThreadCommandExecutor.layer,
      Layer.succeed(McpInvocationContext.McpInvocationContext, {
        environmentId,
        requestNamespace: "provider:theme",
        thread: {
          threadId,
          providerSessionId: "provider:theme",
          providerInstanceId: ProviderInstanceId.make("codex"),
        },
        client: undefined,
        capabilities: new Set(["orchestration" as const]),
        issuedAt: 0,
      }),
      Layer.mock(ThreadManagement.ThreadManagementService)({
        getThreadShell: (id) =>
          Effect.succeed(
            liveThreadShell(id, options.activeRunId === null ? { activeRunId: null } : {}),
          ),
      }),
      Layer.mock(Environment.ServerEnvironment)({
        getDescriptor: Effect.succeed({
          environmentId,
          label: "Test",
          platform: { os: "linux", arch: "x64" },
          serverVersion: "0.0.0",
          capabilities: { repositoryIdentity: false },
        }),
      }),
      EnvironmentTheme.layer.pipe(
        Layer.provideMerge(ServerConfig.layerTest(process.cwd(), baseDir)),
      ),
    );
    return yield* body.pipe(
      Effect.provide(
        McpToolAccess.HandlersLayer.layer(ThemeHandlers.layer).pipe(
          Layer.provideMerge(layerDependencies),
        ),
      ),
    );
  }).pipe(Effect.scoped);

const call = (name: keyof typeof ThemeToolkit.tools, params: unknown) =>
  Effect.gen(function* () {
    const toolkit = yield* ThemeToolkit;
    const results = yield* toolkit
      .handle(name as never, params as never)
      .pipe(Stream.unwrap, Stream.runCollect);
    return results.at(-1)?.result as Record<string, unknown> & {
      readonly code?: string;
      readonly message?: string;
    };
  });

const readSettings = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const { settingsPath } = yield* ServerConfig.ServerConfig;
  return JSON.parse(yield* fs.readFileString(settingsPath)) as Record<string, unknown>;
});

it.layer(NodeServices.layer)("theme tools", (it) => {
  it.effect("guide covers the format, every color role and every data-t3-part", () =>
    withThemeTools(
      Effect.gen(function* () {
        const { guide } = (yield* call("t3_theme_guide", {})) as { guide: string };
        assert.include(guide, "t3_theme_write");
        assert.include(guide, "--app-theme-sidebar-row-active");
        for (const part of THEME_CSS_PARTS) assert.include(guide, `\`${part}\``);
      }),
    ),
  );

  it.effect("writes a theme atomically, lists it, reads it back, and replaces it", () =>
    withThemeTools(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { environmentThemesDir } = yield* ServerConfig.ServerConfig;

        const created = yield* call("t3_theme_write", { themeId: "mint", theme: MINT });
        assert.deepInclude(created, { themeId: "mint", created: true, isDefault: false });
        // Nothing but the theme is left in the directory: no staging files.
        assert.deepEqual(yield* fs.readDirectory(environmentThemesDir), ["mint.json"]);

        const list = yield* call("t3_theme_list", {});
        assert.deepEqual(list.published, [
          { id: "mint", name: "Mint", appearance: "light", appearances: ["light"], hasCss: true },
        ]);
        assert.include(list.reservedIds as ReadonlyArray<string>, "ocean");

        const read = yield* call("t3_theme_read", { themeId: "mint" });
        assert.deepEqual(read, {
          themeId: "mint",
          source: "published",
          isDefault: false,
          theme: MINT,
        });

        const replaced = yield* call("t3_theme_write", {
          themeId: "mint",
          theme: { ...MINT, css: "" },
        });
        assert.strictEqual(replaced.created, false);
      }),
    ),
  );

  it.effect("rejects reserved and malformed ids and oversized themes with a reason", () =>
    withThemeTools(
      Effect.gen(function* () {
        for (const themeId of ["ocean", "dark", "t3-code"]) {
          const result = yield* call("t3_theme_write", { themeId, theme: MINT });
          assert.strictEqual(result.code, "invalid_request");
          assert.include(result.message, "reserved");
        }
        const malformed = yield* call("t3_theme_write", { themeId: "Mint Theme", theme: MINT });
        assert.strictEqual(malformed.code, "invalid_request");
        assert.include(malformed.message, "not a valid theme id");

        const colors = Object.fromEntries(
          Array.from({ length: 600 }, (_, index) => [`role${index}`, `oklch(0.5 0.1 ${index})`]),
        );
        const oversized = yield* call("t3_theme_write", {
          themeId: "huge",
          theme: { ...MINT, colors, css: "a".repeat(MAX_THEME_CSS_LENGTH) },
        });
        assert.strictEqual(oversized.code, "invalid_request");
        assert.include(oversized.message, "limited to");
      }),
    ),
  );

  it.effect("reads a built-in as a theme file to start from", () =>
    withThemeTools(
      Effect.gen(function* () {
        const read = yield* call("t3_theme_read", { themeId: "ocean" });
        assert.strictEqual(read.source, "built-in");
        assert.strictEqual((read.theme as { name: string }).name, "Ocean");
      }),
    ),
  );

  it.effect("sets like `t3 theme set`: a re-set is a new generation, null clears", () =>
    withThemeTools(
      Effect.gen(function* () {
        const unknown = yield* call("t3_theme_set", { themeId: "mint" });
        assert.strictEqual(unknown.code, "invalid_request");

        yield* call("t3_theme_write", { themeId: "mint", theme: MINT });
        const first = yield* call("t3_theme_set", { themeId: "mint" });
        assert.strictEqual(first.defaultTheme, "mint");
        yield* TestClock.adjust("1 second");
        const again = yield* call("t3_theme_set", { themeId: "mint" });
        assert.notStrictEqual(again.defaultThemeSetAt, first.defaultThemeSetAt);
        assert.deepInclude(yield* readSettings, {
          defaultTheme: "mint",
          defaultThemeSetAt: again.defaultThemeSetAt,
        });
        assert.strictEqual(
          (yield* call("t3_theme_write", { themeId: "mint", theme: MINT })).isDefault,
          true,
        );

        const cleared = yield* call("t3_theme_set", { themeId: null });
        assert.strictEqual(cleared.defaultTheme, null);
        const settings = yield* readSettings;
        assert.notProperty(settings, "defaultTheme");
        assert.notProperty(settings, "defaultThemeSetAt");
      }),
    ),
  );

  it.effect("refuses writes from a thread whose run has ended, but still reads", () =>
    withThemeTools(
      Effect.gen(function* () {
        const refused = yield* call("t3_theme_write", { themeId: "mint", theme: MINT });
        assert.strictEqual(refused.code, "parent_not_active");
        assert.strictEqual(
          (yield* call("t3_theme_set", { themeId: "ocean" })).code,
          "parent_not_active",
        );
        assert.isArray((yield* call("t3_theme_list", {})).published);
      }),
      { activeRunId: null },
    ),
  );
});
