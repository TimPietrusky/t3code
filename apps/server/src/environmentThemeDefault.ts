/**
 * The environment's default theme: `defaultTheme` and `defaultThemeSetAt` in
 * the environment's `settings.json`. Written by `t3 theme set` and by the T3
 * Code MCP theme tools; a running server watches the file and pushes the
 * change, so clients switch live.
 *
 * The edit is deliberately a minimal one on the parsed JSON object rather than
 * a schema round-trip. Settings files outlive the build that reads them, and a
 * provisioning command must not drop keys this version does not recognise.
 *
 * @module EnvironmentThemeDefault
 */
import { fromJsonStringPretty, fromLenientJson } from "@t3tools/shared/schemaJson";
import { writeFileStringAtomically } from "@t3tools/shared/atomicWrite";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";

/** Settings files outlive the build that reads them, so the object is carried
 * as-is and only the theme keys are touched. */
const SparseSettings = Schema.Record(Schema.String, Schema.Unknown);
const decodeSettingsJson = Schema.decodeUnknownEffect(fromLenientJson(SparseSettings));
const encodeSettingsJson = Schema.encodeEffect(fromJsonStringPretty(SparseSettings));
export class ThemeSettingsUnreadableError extends Schema.TaggedError<ThemeSettingsUnreadableError>()(
  "ThemeSettingsUnreadableError",
  { settingsPath: Schema.String, cause: Schema.Defect() },
) {
  override get message(): string {
    return `Could not read ${this.settingsPath}. Fix its permissions, then run this again.`;
  }
}

export class ThemeSettingsMalformedError extends Schema.TaggedError<ThemeSettingsMalformedError>()(
  "ThemeSettingsMalformedError",
  { settingsPath: Schema.String, cause: Schema.Defect() },
) {
  override get message(): string {
    return `${this.settingsPath} is not a JSON object. Fix or remove it, then run this again.`;
  }
}

export class ThemeSettingsBusyError extends Schema.TaggedError<ThemeSettingsBusyError>()(
  "ThemeSettingsBusyError",
  { settingsPath: Schema.String, attempts: Schema.Number },
) {
  override get message(): string {
    return `${this.settingsPath} kept changing while writing (gave up after ${this.attempts} attempts). Try again.`;
  }
}

export class ThemeSettingsWriteError extends Schema.TaggedError<ThemeSettingsWriteError>()(
  "ThemeSettingsWriteError",
  { settingsPath: Schema.String, cause: Schema.Defect() },
) {
  override get message(): string {
    return `Could not write ${this.settingsPath}.`;
  }
}

/**
 * Reads the sparse settings object, treating only a genuinely absent file as
 * empty. A permission or I/O error must propagate: reading it as "no settings"
 * would have the caller write a fresh sparse file over settings it never saw.
 */
export const readSettingsObject = Effect.fn(function* (settingsPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(settingsPath)
    .pipe(Effect.mapError((cause) => new ThemeSettingsUnreadableError({ settingsPath, cause })));
  if (!exists) return { raw: "", settings: {} };

  const raw = yield* fs
    .readFileString(settingsPath)
    .pipe(Effect.mapError((cause) => new ThemeSettingsUnreadableError({ settingsPath, cause })));
  if (raw.trim().length === 0) return { raw, settings: {} };

  const settings = yield* decodeSettingsJson(raw).pipe(
    Effect.mapError((cause) => new ThemeSettingsMalformedError({ settingsPath, cause })),
  );
  return { raw, settings };
});

/**
 * A running server owns this file too, and its write path is an in-process
 * semaphore that cannot serialize against another process. So the document is
 * re-read immediately before the rename and the whole edit is retried when it
 * moved underneath us, which is what turns "last writer wins" into "last
 * writer merges", and an edit that keeps losing the race fails loudly rather
 * than overwriting. A write landing inside the remaining rename window is
 * still possible; the server's own watcher reconciles the file either way.
 */
const CONCURRENT_WRITE_ATTEMPTS = 5;

export const writeDefaultTheme = Effect.fn(function* (input: {
  readonly settingsPath: string;
  readonly themeId: string;
}) {
  const fs = yield* FileSystem.FileSystem;

  for (let attempt = 1; ; attempt++) {
    const { raw, settings } = yield* readSettingsObject(input.settingsPath);
    const setAt = DateTime.formatIso(yield* DateTime.now);
    const next =
      input.themeId.length > 0
        ? // The timestamp is the set-generation: it lets clients apply a re-set
          // of the same value they already applied once.
          { ...settings, defaultTheme: input.themeId, defaultThemeSetAt: setAt }
        : // Clearing removes the keys rather than storing empty strings, so the
          // file reads the same as one that never set a theme.
          Object.fromEntries(
            Object.entries(settings).filter(
              ([key]) => key !== "defaultTheme" && key !== "defaultThemeSetAt",
            ),
          );

    const contents = yield* encodeSettingsJson(next);
    const current = yield* fs
      .readFileString(input.settingsPath)
      .pipe(Effect.orElseSucceed(() => ""));
    if (current !== raw) {
      // Falling through here would overwrite whatever landed in between, which
      // is exactly the loss this loop exists to prevent.
      if (attempt >= CONCURRENT_WRITE_ATTEMPTS) {
        return yield* new ThemeSettingsBusyError({
          settingsPath: input.settingsPath,
          attempts: CONCURRENT_WRITE_ATTEMPTS,
        });
      }
      continue;
    }

    yield* writeFileStringAtomically({
      filePath: input.settingsPath,
      contents: `${contents}\n`,
    }).pipe(
      Effect.mapError(
        (cause) => new ThemeSettingsWriteError({ settingsPath: input.settingsPath, cause }),
      ),
    );
    return;
  }
});

/** The environment's default theme as the settings file records it. */
export const readDefaultTheme = Effect.fn(function* (settingsPath: string) {
  const { settings } = yield* readSettingsObject(settingsPath);
  const theme =
    typeof settings.defaultTheme === "string" && settings.defaultTheme.length > 0
      ? settings.defaultTheme
      : null;
  const setAt = typeof settings.defaultThemeSetAt === "string" ? settings.defaultThemeSetAt : "";
  return { theme, setAt };
});
