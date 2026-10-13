// @effect-diagnostics nodeBuiltinImport:off - the guarded file read needs open
// flags (O_NOFOLLOW, O_NONBLOCK) the FileSystem service does not expose.
/**
 * EnvironmentTheme - palettes this machine publishes for clients to follow.
 *
 * A desktop that retints its apps when the user switches system theme writes
 * `<stateDir>/themes/<id>.json`; this service watches that directory and
 * streams the published set to connected clients so a theme change lands
 * without a restart. The filename is the theme id: it stays stable while the
 * machine rewrites the colors underneath, so `defaultTheme` and a client\'s
 * selection keep pointing at the same theme across recolors. Theming is
 * cosmetic, so every failure here degrades to "not published" rather than
 * propagating.
 *
 * @module EnvironmentTheme
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  EnvironmentTheme,
  EnvironmentThemeFile,
  EnvironmentThemeId,
  environmentThemeFileHasColors,
  MAX_THEME_ASSETS_LENGTH,
} from "@t3tools/contracts";
import { writeFileStringAtomically } from "@t3tools/shared/atomicWrite";
import { fromJsonStringPretty } from "@t3tools/shared/schemaJson";
import { BUILT_IN_THEME_IDS, UNPUBLISHABLE_THEME_IDS } from "@t3tools/shared/themePalettes";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import * as ServerConfig from "./config.ts";
import { readDefaultTheme, writeDefaultTheme } from "./environmentThemeDefault.ts";

const decodeEnvironmentThemeFileJsonExit = Schema.decodeUnknownExit(
  Schema.fromJsonString(EnvironmentThemeFile),
);
const isEnvironmentThemeId = Schema.is(EnvironmentThemeId);
const encodeThemeFileJson = Schema.encodeEffect(fromJsonStringPretty(EnvironmentThemeFile));

const THEME_FILE_SUFFIX = ".json";

/**
 * Bounds on what a machine can publish. The directory is local, so this is not
 * a trust boundary -- but an accidental dump of large files there would
 * otherwise be read in full, streamed to every client, and repainted, so the
 * cost of a mistake is capped rather than unbounded.
 */
const MAX_THEME_FILES = 32;
/**
 * Exported so the publish path cannot accept a file the watcher will skip.
 * Room for the largest images a theme may carry plus its palette and CSS
 * (JSON escaping can grow CSS several times over).
 */
export const MAX_THEME_FILE_BYTES = MAX_THEME_ASSETS_LENGTH + 128 * 1024;
/**
 * The set travels whole in a websocket event to every subscriber, so the sum
 * matters more than any single file. Palette-only themes run a few KB; this
 * leaves room for a handful of themes carrying full-size images while keeping
 * an accidental dump off the wire.
 */
const MAX_THEME_TOTAL_BYTES = 6 * MAX_THEME_FILE_BYTES;

/** A publish or set the caller can fix: the message says how. */
export class EnvironmentThemeRejectedError extends Schema.TaggedError<EnvironmentThemeRejectedError>()(
  "EnvironmentThemeRejectedError",
  { reason: Schema.String },
) {
  override get message(): string {
    return this.reason;
  }
}

export class EnvironmentThemeStorageError extends Schema.TaggedError<EnvironmentThemeStorageError>()(
  "EnvironmentThemeStorageError",
  { operation: Schema.String, cause: Schema.Defect() },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}

/** The environment's default theme, as `t3 theme set` records it. */
export interface EnvironmentDefaultTheme {
  readonly theme: string | null;
  readonly setAt: string;
}

/** Why an id cannot be published, or null when it can. */
export const unpublishableThemeIdReason = (themeId: string): string | null => {
  if (UNPUBLISHABLE_THEME_IDS.has(themeId)) {
    return `"${themeId}" is reserved: built-in themes and the appearance keywords cannot be replaced. Publish under another id.`;
  }
  if (!isEnvironmentThemeId(themeId)) {
    return `"${themeId}" is not a valid theme id: use 1-48 lowercase letters, digits, and hyphens, starting with a letter or digit.`;
  }
  return null;
};

/** The published set with the sequence number it was observed at. */
interface PublishedThemes {
  readonly seq: number;
  readonly themes: ReadonlyArray<EnvironmentTheme>;
}

export class EnvironmentThemeService extends Context.Service<
  EnvironmentThemeService,
  {
    /**
     * The set published right now, read from disk rather than from the
     * watcher\'s last observation: a client connecting must see what the
     * machine actually publishes even if it missed a filesystem event.
     */
    readonly current: Effect.Effect<ReadonlyArray<EnvironmentTheme>>;

    /**
     * The current set followed by every change, with repeats dropped. The
     * subscription is acquired before the current set is read, so a publish
     * landing while a client connects is delivered rather than lost.
     */
    readonly streamChanges: Stream.Stream<ReadonlyArray<EnvironmentTheme>>;

    /**
     * Writes `<themesDir>/<themeId>.json` atomically and republishes at once,
     * so connected clients retint without waiting for the watcher. Applies the
     * watcher's own rules first, so it never reports success for a file the
     * watcher would then skip.
     */
    readonly publish: (input: {
      readonly themeId: string;
      readonly file: EnvironmentThemeFile;
    }) => Effect.Effect<
      { readonly created: boolean; readonly theme: EnvironmentTheme },
      EnvironmentThemeRejectedError | EnvironmentThemeStorageError
    >;

    /** Where published theme files live. */
    readonly themesDirectory: string;

    readonly readDefault: Effect.Effect<EnvironmentDefaultTheme, EnvironmentThemeStorageError>;

    /**
     * Sets (or, with null, clears) the environment's default theme exactly as
     * `t3 theme set` does: each set switches connected clients once, including
     * a re-set of the theme already set.
     */
    readonly setDefault: (
      themeId: string | null,
    ) => Effect.Effect<
      EnvironmentDefaultTheme,
      EnvironmentThemeRejectedError | EnvironmentThemeStorageError
    >;
  }
>()("t3/environmentTheme/EnvironmentThemeService") {}

/**
 * Reads a theme file through one opened handle, so every check binds to the
 * file actually read rather than to a path that may have been swapped since:
 * O_NOFOLLOW rejects a symlink outright (a symlinked themes directory stays
 * usable, a symlinked file inside it does not), O_NONBLOCK keeps a FIFO from
 * blocking the open, and the fstat type and size gate examines the open
 * descriptor. Returns null for anything that is not a small regular file.
 *
 * Windows has neither flag (the constants are undefined, and OR-ing them in
 * is a no-op), so the symlink check there is an lstat before the open. That
 * leaves a window a swap could slip through, which the descriptor-bound
 * checks below then narrow to "a regular file at that path".
 */
export const readThemeFileGuarded = (filePath: string, maxBytes: number): string | null =>
  readFileGuarded(filePath, maxBytes)?.toString("utf8") ?? null;

/** The bytes behind readThemeFileGuarded, for files that are not text. */
const readFileGuarded = (filePath: string, maxBytes: number): Buffer | null => {
  let fd: number;
  try {
    if (NodeFS.constants.O_NOFOLLOW === undefined && NodeFS.lstatSync(filePath).isSymbolicLink()) {
      return null;
    }
    fd = NodeFS.openSync(
      filePath,
      NodeFS.constants.O_RDONLY |
        (NodeFS.constants.O_NOFOLLOW ?? 0) |
        (NodeFS.constants.O_NONBLOCK ?? 0),
    );
  } catch {
    return null;
  }
  try {
    const info = NodeFS.fstatSync(fd);
    if (!info.isFile() || info.size > maxBytes) return null;
    const contents = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < contents.length) {
      const read = NodeFS.readSync(fd, contents, offset, contents.length - offset, offset);
      if (read <= 0) break;
      offset += read;
    }
    return contents.subarray(0, offset);
  } catch {
    return null;
  } finally {
    NodeFS.closeSync(fd);
  }
};

/** Largest image file that still fits the asset budget once base64-encoded. */
const MAX_THEME_ASSET_FILE_BYTES = Math.floor((MAX_THEME_ASSETS_LENGTH * 3) / 4);

const ascii = (bytes: Buffer, start: number, end: number) =>
  bytes.subarray(start, end).toString("latin1");

/** The image type a file's leading bytes declare, or null for anything else. */
export const sniffThemeAssetMimeType = (bytes: Buffer): string | null => {
  if (bytes.length >= 8 && bytes.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (ascii(bytes, 0, 4) === "GIF8") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12))) {
    return "image/avif";
  }
  const head = bytes
    .subarray(0, 1024)
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart();
  if (
    /^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)
  ) {
    return "image/svg+xml";
  }
  return null;
};

/**
 * An image file on this machine as a theme asset data URI, so an agent can
 * put a photo in a theme by path instead of pasting a megabyte of base64.
 */
export const readThemeAssetFile = (
  filePath: string,
): { readonly dataUri: string } | { readonly problem: string } => {
  if (!NodePath.isAbsolute(filePath)) {
    return { problem: `${filePath} is not an absolute path.` };
  }
  let size: number;
  try {
    size = NodeFS.statSync(filePath).size;
  } catch {
    return { problem: `${filePath} does not exist or cannot be read.` };
  }
  if (size > MAX_THEME_ASSET_FILE_BYTES) {
    return {
      problem: `${filePath} is ${Math.ceil(size / 1024)} KB; theme images are limited to ${Math.floor(MAX_THEME_ASSET_FILE_BYTES / 1024)} KB in total. Resize it (about 2400px wide as WebP or JPEG is plenty for a background).`,
    };
  }
  const bytes = readFileGuarded(filePath, MAX_THEME_ASSET_FILE_BYTES);
  if (bytes === null) return { problem: `${filePath} is not a regular file that can be read.` };
  const mimeType = sniffThemeAssetMimeType(bytes);
  if (mimeType === null) {
    return { problem: `${filePath} is not a PNG, JPEG, WebP, AVIF, GIF or SVG image.` };
  }
  return { dataUri: `data:${mimeType};base64,${bytes.toString("base64")}` };
};

/**
 * Every theme the directory actually publishes. A file that is missing,
 * unreadable, malformed, colorless, or misnamed is simply skipped; the rest of
 * the set is unaffected. The one place that decides what "published" means, so
 * a caller validating an id cannot disagree with the watcher serving it.
 */
export const readPublishedThemes = Effect.fn(function* (themesDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs
    .readDirectory(themesDir)
    .pipe(Effect.orElseSucceed((): Array<string> => []));

  const themes: Array<EnvironmentTheme> = [];
  let examined = 0;
  let totalBytes = 0;
  for (const entry of entries.toSorted()) {
    if (!entry.endsWith(THEME_FILE_SUFFIX)) continue;
    const id = entry.slice(0, -THEME_FILE_SUFFIX.length);
    // A reserved id is either shadowed by a built-in on the client or captures
    // clients that never chose it, so it is not publishable.
    if (!isEnvironmentThemeId(id) || UNPUBLISHABLE_THEME_IDS.has(id)) continue;

    // Counts files examined, not themes accepted: capping the output would
    // let a directory of malformed files be opened, read, and decoded in full
    // on every refresh and every client connect.
    examined += 1;
    if (examined > MAX_THEME_FILES) {
      yield* Effect.logWarning("ignoring environment theme files past the limit", {
        path: themesDir,
        limit: MAX_THEME_FILES,
      });
      break;
    }

    const filePath = `${themesDir}/${entry}`;
    const raw = readThemeFileGuarded(filePath, MAX_THEME_FILE_BYTES);
    if (raw === null) {
      yield* Effect.logWarning("ignoring unusable environment theme file", {
        path: filePath,
        limit: MAX_THEME_FILE_BYTES,
      });
      continue;
    }
    if (raw.trim().length === 0) continue;

    const decoded = decodeEnvironmentThemeFileJsonExit(raw);
    if (decoded._tag === "Failure") {
      yield* Effect.logWarning("ignoring invalid environment theme", {
        path: filePath,
        detail: Cause.pretty(decoded.cause),
      });
      continue;
    }
    const file = decoded.value;
    if (!environmentThemeFileHasColors(file)) {
      yield* Effect.logWarning("ignoring environment theme without colors", { path: filePath });
      continue;
    }

    // Counted only once accepted: the cap bounds what travels to clients, so
    // a skipped file must not eat the budget of valid themes sorted after it.
    // Bytes, not string length -- the cap describes wire weight.
    totalBytes += Buffer.byteLength(raw);
    if (totalBytes > MAX_THEME_TOTAL_BYTES) {
      yield* Effect.logWarning("ignoring environment themes past the total size limit", {
        path: themesDir,
        limit: MAX_THEME_TOTAL_BYTES,
      });
      break;
    }

    themes.push({ id, ...file });
  }
  return themes;
});

/**
 * Reads the directory and folds it into the sequenced state, publishing only
 * a genuine change. Every reader goes through here, so the snapshot a client
 * connects on and the events it then receives come from one ordered source
 * rather than from disk and the queue independently.
 */

const make = Effect.gen(function* () {
  const { environmentThemesDir, settingsPath } = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  /**
   * Sliding with capacity 1: every update carries the complete set, so a
   * subscriber that stops consuming holds at most the newest set rather than
   * an unbounded backlog. Every observed set carries a sequence number, so a
   * subscriber can drop queued events that predate the snapshot it started
   * from. Without it a publish landing between subscribing and reading
   * replays after the newer value and walks clients backwards onto stale
   * colors.
   */
  const changes = yield* PubSub.sliding<PublishedThemes>(1);
  const published = yield* Ref.make<PublishedThemes>({ seq: 0, themes: [] });
  /**
   * Guards the whole read/compare/publish, not just the state update. The
   * directory read is async, so two concurrent refreshes can finish out of
   * order and a slower read of an older set would publish under a higher
   * sequence -- which the subscriber filter, ordering publications rather than
   * observations, could not then drop.
   */
  const refreshSemaphore = yield* Semaphore.make(1);
  const watcherScope = yield* Scope.make("sequential");
  yield* Effect.addFinalizer(() => Scope.close(watcherScope, Exit.void));

  const refresh = refreshSemaphore.withPermits(1)(
    Effect.gen(function* () {
      const themes = yield* readPublishedThemes(environmentThemesDir).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
      );
      // Structural equality over the whole decoded value: a hand-rolled field
      // list here silently drops republishes for any field it forgets.
      const [changed, next] = yield* Ref.modify(
        published,
        (previous): readonly [readonly [boolean, PublishedThemes], PublishedThemes] => {
          if (Equal.equals(previous.themes, themes)) return [[false, previous], previous];
          const updated: PublishedThemes = { seq: previous.seq + 1, themes };
          return [[true, updated], updated];
        },
      );
      if (changed) yield* PubSub.publish(changes, next).pipe(Effect.asVoid);
      return next;
    }),
  );

  // The directory is created up front so the watcher has something to attach
  // to before the first publisher writes into it.
  yield* fs
    .makeDirectory(environmentThemesDir, { recursive: true })
    .pipe(Effect.ignoreCause({ log: true }));

  // Debounced for the same reason settings watching is: a theme script emits
  // several events per save and `fs.watch` can fire before the content is
  // flushed. Every event triggers a full re-read, so no event needs filtering.
  const watchEvents = fs.watch(environmentThemesDir).pipe(Stream.debounce(Duration.millis(100)));

  // Seeds the dedupe so a watch event that reports no actual change (a touch,
  // a rewrite with identical contents) does not retint every client.
  yield* refresh;
  yield* Stream.runForEach(watchEvents, () => refresh.pipe(Effect.ignoreCause({ log: true }))).pipe(
    Effect.ignoreCause({ log: true }),
    Effect.forkIn(watcherScope),
    Effect.asVoid,
  );

  const storageError = (operation: string) => (cause: unknown) =>
    new EnvironmentThemeStorageError({ operation, cause });

  const publish: EnvironmentThemeService["Service"]["publish"] = Effect.fn(
    "EnvironmentTheme.publish",
  )(function* ({ themeId, file }) {
    const idReason = unpublishableThemeIdReason(themeId);
    if (idReason !== null) return yield* new EnvironmentThemeRejectedError({ reason: idReason });
    if (!environmentThemeFileHasColors(file)) {
      return yield* new EnvironmentThemeRejectedError({
        reason: "The theme has no colors: give canvas and accent, or a colors object.",
      });
    }
    const contents = `${yield* encodeThemeFileJson(file).pipe(
      Effect.mapError(
        (cause) =>
          new EnvironmentThemeRejectedError({ reason: `The theme is invalid: ${String(cause)}` }),
      ),
    )}\n`;
    const bytes = Buffer.byteLength(contents);
    if (bytes > MAX_THEME_FILE_BYTES) {
      return yield* new EnvironmentThemeRejectedError({
        reason: `The theme is ${bytes} bytes; a published theme is limited to ${MAX_THEME_FILE_BYTES}.`,
      });
    }
    if (decodeEnvironmentThemeFileJsonExit(contents)._tag === "Failure") {
      return yield* new EnvironmentThemeRejectedError({ reason: "The theme is invalid." });
    }

    const filePath = path.join(environmentThemesDir, `${themeId}${THEME_FILE_SUFFIX}`);
    const existing = yield* fs.stat(filePath).pipe(Effect.option);
    // The watcher refuses symlinks and anything else that is not a plain file,
    // and writing through one would publish nothing.
    if (existing._tag === "Some" && existing.value.type !== "File") {
      return yield* new EnvironmentThemeRejectedError({
        reason: `${filePath} exists and is not a regular file; remove it or use another id.`,
      });
    }
    yield* writeFileStringAtomically({ filePath, contents }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError(storageError(`write ${filePath}`)),
    );
    const state = yield* refresh;
    const theme = state.themes.find((candidate) => candidate.id === themeId);
    if (theme === undefined) {
      return yield* new EnvironmentThemeRejectedError({
        reason: `Wrote ${filePath}, but it is not published: the themes directory is over its file count or total size limit. Remove unused themes.`,
      });
    }
    return { created: existing._tag === "None", theme };
  });

  const readDefault = readDefaultTheme(settingsPath).pipe(
    Effect.provideService(FileSystem.FileSystem, fs),
    Effect.mapError(storageError(`read ${settingsPath}`)),
  );

  const setDefault: EnvironmentThemeService["Service"]["setDefault"] = Effect.fn(
    "EnvironmentTheme.setDefault",
  )(function* (themeId) {
    if (themeId !== null) {
      const state = yield* refresh;
      const known = [...BUILT_IN_THEME_IDS, ...state.themes.map((theme) => theme.id)];
      if (!known.includes(themeId)) {
        return yield* new EnvironmentThemeRejectedError({
          reason: `No theme named "${themeId}". Available: ${known.toSorted().join(", ")}. Publish it first.`,
        });
      }
    }
    yield* writeDefaultTheme({ settingsPath, themeId: themeId ?? "" }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError(storageError(`write ${settingsPath}`)),
    );
    return yield* readDefault;
  });

  return {
    themesDirectory: environmentThemesDir,
    publish,
    readDefault,
    setDefault,
    current: Effect.map(refresh, (state) => state.themes),
    get streamChanges() {
      return Stream.unwrap(
        Effect.gen(function* () {
          // Subscribe first so nothing published during the read is missed,
          // then drop anything the snapshot already accounts for.
          const subscription = yield* PubSub.subscribe(changes);
          const snapshot = yield* refresh;
          return Stream.concat(
            Stream.make(snapshot.themes),
            Stream.fromSubscription(subscription).pipe(
              Stream.filter((update) => update.seq > snapshot.seq),
              Stream.map((update) => update.themes),
            ),
          );
        }),
      );
    },
  } satisfies EnvironmentThemeService["Service"];
});

export const layer = Layer.effect(EnvironmentThemeService, make);
