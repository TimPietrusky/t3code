import { EnvironmentThemeFile, OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/ai";

import * as ServerEnvironment from "../../../environment/ServerEnvironment.ts";
import * as EnvironmentTheme from "../../../environmentTheme.ts";
import * as ThreadCommandExecutor from "../../../orchestration-v2/ThreadCommandExecutor.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";

const shared = {
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
    ServerEnvironment.ServerEnvironment,
    EnvironmentTheme.EnvironmentThemeService,
    ThreadCommandExecutor.ThreadCommandExecutor,
  ],
};

const Appearance = Schema.Literals(["light", "dark"]);
const ThemeId = Schema.String.annotate({
  description:
    "Theme id: lowercase letters, digits and hyphens, e.g. 'mint-dream'. Built-in ids and light/dark/system are reserved.",
});
const Notes = Schema.Array(Schema.String).annotate({
  description: "Things to tell the user, such as a local copy that overrides this theme.",
});

const ThemeGuideTool = Tool.make("t3_theme_guide", {
  ...shared,
  description:
    "Start here to restyle T3 Code. Returns the theme format (palette and optional custom CSS), every color role, the data-t3-part hooks CSS can target, and the rules for what is safe to change. Then write a theme with t3_theme_write and switch the app to it with t3_theme_set.",
  success: Schema.Struct({ guide: Schema.String }),
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

const ThemeListTool = Tool.make("t3_theme_list", {
  ...shared,
  description:
    "List this environment's themes: built-ins, themes it publishes (the ones t3_theme_write creates), the environment theme set with t3_theme_set, and the reserved ids a published theme cannot use.",
  success: Schema.Struct({
    defaultTheme: Schema.NullOr(Schema.String).annotate({
      description: "The environment theme set with t3_theme_set, or null.",
    }),
    defaultThemeSetAt: Schema.String,
    builtIn: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        appearances: Schema.Array(Appearance),
      }),
    ),
    published: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        appearance: Appearance,
        appearances: Schema.Array(Appearance),
        hasCss: Schema.Boolean,
        assets: Schema.Array(Schema.String).annotate({
          description: "Names of the theme's images, each var(--t3-asset-<name>) in its css.",
        }),
      }),
    ),
    reservedIds: Schema.Array(Schema.String),
    themesDirectory: Schema.String,
  }),
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

const ThemeReadTool = Tool.make("t3_theme_read", {
  ...shared,
  description:
    "Read one theme as a theme file, including its custom CSS: a published theme as written, or a built-in's palette to start a new theme from. Image data is not returned, only each image's name and size; t3_theme_write keeps a theme's images unless you replace them.",
  parameters: Schema.Struct({ themeId: ThemeId }),
  success: Schema.Struct({
    themeId: Schema.String,
    source: Schema.Literals(["built-in", "published"]),
    isDefault: Schema.Boolean,
    theme: EnvironmentThemeFile,
    assets: Schema.Array(
      Schema.Struct({ name: Schema.String, variable: Schema.String, bytes: Schema.Number }),
    ).annotate({ description: "The theme's images, left out of theme.assets." }),
  }),
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

const ThemeWriteTool = Tool.make("t3_theme_write", {
  ...shared,
  description:
    "Create or replace a theme this environment publishes to its web and desktop clients. Read t3_theme_guide first for the format. Either give appearance, canvas and accent hex colors (the rest of the palette is generated; colors overrides roles) or a full colors palette, plus optional variants for the other appearance and optional css. Put photos in with assetFiles (absolute paths to image files on this machine); the theme's existing images are kept unless theme.assets is given. Replacing the theme clients are showing retints them live; to switch clients to a new theme, call t3_theme_set. Requires a live full-access/default calling thread.",
  parameters: Schema.Struct({
    themeId: ThemeId,
    theme: EnvironmentThemeFile,
    assetFiles: Schema.optional(
      Schema.Record(Schema.String, Schema.String).annotate({
        description:
          'Images to embed, asset name to absolute file path on this machine, e.g. { "bg": "/tmp/meadow.webp" }. Each becomes var(--t3-asset-<name>) in css. PNG, JPEG, WebP, AVIF, GIF or SVG; about 750 KB of files in total, so resize photos to about 2400px wide first.',
      }),
    ),
  }),
  success: Schema.Struct({
    themeId: Schema.String,
    created: Schema.Boolean,
    isDefault: Schema.Boolean,
    notes: Notes,
  }),
})
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true);

const ThemeSetTool = Tool.make("t3_theme_set", {
  ...shared,
  description:
    "Set the environment theme, like `t3 theme set`: every connected web and desktop client switches to it once, even when it is already set. A built-in or a theme published with t3_theme_write. Pass null to clear it; clients keep what they show. Users can still pick another theme afterwards. Requires a live full-access/default calling thread.",
  parameters: Schema.Struct({
    themeId: Schema.NullOr(ThemeId),
  }),
  success: Schema.Struct({
    defaultTheme: Schema.NullOr(Schema.String),
    defaultThemeSetAt: Schema.String,
    notes: Notes,
  }),
}).annotate(Tool.Destructive, true);

export const ThemeToolkit = Toolkit.make(
  ThemeGuideTool,
  ThemeListTool,
  ThemeReadTool,
  ThemeWriteTool,
  ThemeSetTool,
);
