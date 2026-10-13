import { type EnvironmentThemeFile, OrchestratorMcpFailure } from "@t3tools/contracts";
import {
  BUILT_IN_THEMES,
  getThemeColorsForAppearance,
  UNPUBLISHABLE_THEME_IDS,
  type ThemeAppearance,
} from "@t3tools/shared/themePalettes";
import * as Effect from "effect/Effect";

import * as Environment from "../../../environment/ServerEnvironment.ts";
import * as EnvironmentTheme from "../../../environmentTheme.ts";
import * as ThreadCommandExecutor from "../../../orchestration-v2/ThreadCommandExecutor.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { readCaller } from "../../threadAccess.ts";
import { themeGuideMarkdown } from "./guide.ts";
import { ThemeToolkit } from "./tools.ts";

const APPEARANCES: ReadonlyArray<ThemeAppearance> = ["light", "dark"];

const publishedAppearances = (theme: EnvironmentThemeFile): ReadonlyArray<ThemeAppearance> =>
  APPEARANCES.filter(
    (appearance) => appearance === theme.appearance || theme.variants?.[appearance] !== undefined,
  );

/**
 * Clients resolve a theme the user saved on their own device before the one
 * this environment publishes under the same id, and the server cannot see
 * those device copies, so every result that targets an id says so.
 */
const shadowNote = (themeId: string) =>
  `If someone saved their own theme with the id "${themeId}" in Settings → Appearance, that device keeps showing their copy; they can remove it there, or you can publish under another id.`;

const failure = (
  error:
    | EnvironmentTheme.EnvironmentThemeRejectedError
    | EnvironmentTheme.EnvironmentThemeStorageError,
) =>
  new OrchestratorMcpFailure({
    code:
      error._tag === "EnvironmentThemeRejectedError" ? "invalid_request" : "orchestration_error",
    message: error.message,
  });

const access = Effect.gen(function* () {
  const context = yield* readCaller();
  const environment = yield* Environment.ServerEnvironment;
  const descriptor = yield* environment.getDescriptor;
  if (descriptor.environmentId !== context.scope.environmentId)
    return yield* new OrchestratorMcpFailure({
      code: "capability_denied",
      message: "This credential belongs to another environment.",
    });
  return yield* EnvironmentTheme.EnvironmentThemeService;
});

/** A thread caller serializes with its own turn; a client has no thread to lock. */
const withCallerLock = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const scope = yield* McpInvocationContext.McpInvocationContext;
    const executor = yield* ThreadCommandExecutor.ThreadCommandExecutor;
    return yield* scope.thread === undefined
      ? effect
      : executor.withLock(scope.thread.threadId, effect);
  });

export const layer = McpToolAccess.toLayer(ThemeToolkit, {
  t3_theme_guide: McpToolAccess.reads(() =>
    access.pipe(Effect.as({ guide: themeGuideMarkdown() })),
  ),
  t3_theme_list: McpToolAccess.reads(() =>
    Effect.gen(function* () {
      const themes = yield* access;
      const published = yield* themes.current;
      const current = yield* themes.readDefault.pipe(Effect.mapError(failure));
      return {
        defaultTheme: current.theme,
        defaultThemeSetAt: current.setAt,
        builtIn: BUILT_IN_THEMES.map((theme) => ({
          id: theme.id,
          name: theme.label,
          appearances: APPEARANCES.filter(
            (appearance) => getThemeColorsForAppearance(theme, appearance) !== null,
          ),
        })),
        published: published.map((theme) => ({
          id: theme.id,
          name: theme.name,
          appearance: theme.appearance,
          appearances: publishedAppearances(theme),
          hasCss: (theme.css ?? "").trim().length > 0,
        })),
        reservedIds: [...UNPUBLISHABLE_THEME_IDS].toSorted(),
        themesDirectory: themes.themesDirectory,
      };
    }),
  ),
  t3_theme_read: McpToolAccess.reads(({ themeId }) =>
    Effect.gen(function* () {
      const themes = yield* access;
      const current = yield* themes.readDefault.pipe(Effect.mapError(failure));
      const isDefault = current.theme === themeId;
      const publishedTheme = (yield* themes.current).find((theme) => theme.id === themeId);
      if (publishedTheme !== undefined) {
        const { id: _id, ...theme } = publishedTheme;
        return { themeId, source: "published" as const, isDefault, theme };
      }
      const builtIn = BUILT_IN_THEMES.find((theme) => theme.id === themeId);
      if (builtIn === undefined) {
        return yield* new OrchestratorMcpFailure({
          code: "invalid_request",
          message: `No theme named "${themeId}". Call t3_theme_list for the available ids.`,
        });
      }
      const otherAppearance = builtIn.appearance === "light" ? "dark" : "light";
      const variant = getThemeColorsForAppearance(builtIn, otherAppearance);
      return {
        themeId,
        source: "built-in" as const,
        isDefault,
        theme: {
          version: 1 as const,
          name: builtIn.label,
          appearance: builtIn.appearance,
          colors: builtIn.colors,
          ...(variant ? { variants: { [otherAppearance]: variant } } : {}),
        },
      };
    }),
  ),
  t3_theme_write: McpToolAccess.writesEnvironment(({ themeId, theme }, check) =>
    withCallerLock(
      Effect.gen(function* () {
        // The turn may have ended, or the thread's modes changed, while this waited for the lock.
        yield* check;
        const themes = yield* access;
        const { created } = yield* themes
          .publish({ themeId, file: theme })
          .pipe(Effect.mapError(failure));
        const current = yield* themes.readDefault.pipe(Effect.mapError(failure));
        const isDefault = current.theme === themeId;
        return {
          themeId,
          created,
          isDefault,
          notes: [
            isDefault
              ? "This is the environment theme: clients showing it retint now. Call t3_theme_set to switch clients that moved to another theme back to it."
              : `Clients showing "${themeId}" retint now. Call t3_theme_set with this id to switch every client to it.`,
            shadowNote(themeId),
          ],
        };
      }),
    ),
  ),
  t3_theme_set: McpToolAccess.writesEnvironment(({ themeId }, check) =>
    withCallerLock(
      Effect.gen(function* () {
        yield* check;
        const themes = yield* access;
        const current = yield* themes.setDefault(themeId).pipe(Effect.mapError(failure));
        return {
          defaultTheme: current.theme,
          defaultThemeSetAt: current.setAt,
          notes:
            themeId === null
              ? ["Cleared. Clients keep the theme they show."]
              : [
                  `Connected web and desktop clients switch to "${themeId}" now; offline ones when they reconnect.`,
                  shadowNote(themeId),
                ],
        };
      }),
    ),
  ),
});
