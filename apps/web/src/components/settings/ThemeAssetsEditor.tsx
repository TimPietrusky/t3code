import {
  MAX_THEME_ASSET_COUNT,
  MAX_THEME_ASSETS_LENGTH,
  THEME_ASSET_DATA_URI_PATTERN,
  themeAssetVariable,
} from "@t3tools/contracts";
import { ImagePlusIcon, XIcon } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

type ThemeAssets = Readonly<Record<string, string>>;

/** Photos are re-encoded to fit; vector and animated images are kept as they are. */
const KEEP_AS_IS = new Set(["image/svg+xml", "image/gif"]);

/** Tried in order until one fits the space left: long edge in px, WebP quality. */
const ENCODE_STEPS: ReadonlyArray<readonly [number, number]> = [
  [2560, 0.86],
  [2560, 0.76],
  [1920, 0.8],
  [1600, 0.76],
  [1280, 0.72],
  [960, 0.7],
];

export function themeAssetsLength(assets: ThemeAssets): number {
  return Object.values(assets).reduce((total, uri) => total + uri.length, 0);
}

/** A free asset name derived from a file name: `Sunny Meadow.jpg` becomes `sunny-meadow`. */
export function themeAssetNameFromFile(fileName: string, taken: Iterable<string>): string {
  const stem = fileName.replace(/\.[^.]*$/, "");
  let base = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28)
    .replace(/-+$/, "");
  if (!/^[a-z]/.test(base)) base = `image${base ? `-${base}` : ""}`.slice(0, 28);
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let copy = 2; ; copy += 1) {
    const candidate = `${base}-${copy}`;
    if (!used.has(candidate)) return candidate;
  }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Could not read the image.")),
    );
    reader.readAsDataURL(file);
  });
}

/** The image as a data URI no longer than `budget`, or null when even the smallest step is too big. */
async function encodeThemeImage(file: File, budget: number): Promise<string | null> {
  if (KEEP_AS_IS.has(file.type)) {
    const uri = await readAsDataUrl(file);
    return uri.length <= budget ? uri : null;
  }
  const bitmap = await createImageBitmap(file);
  try {
    for (const [longEdge, quality] of ENCODE_STEPS) {
      const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not process the image.");
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // Engines without a WebP encoder fall back to PNG, which is far larger
      // for photos, so JPEG is the second choice.
      let uri = canvas.toDataURL("image/webp", quality);
      if (!uri.startsWith("data:image/webp")) uri = canvas.toDataURL("image/jpeg", quality);
      if (uri.length <= budget) return uri;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

function formatKb(length: number): string {
  return `${Math.ceil(length / 1024).toLocaleString()} KB`;
}

/**
 * The theme's images. Each becomes a CSS variable the stylesheet uses, e.g.
 * `background-image: var(--t3-asset-meadow)`. Added photos are resized and
 * re-encoded as WebP so they fit the theme's image budget.
 */
export function ThemeAssetsEditor({
  assets,
  onChange,
}: {
  assets: ThemeAssets;
  onChange: (assets: ThemeAssets) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const entries = Object.entries(assets);
  const used = themeAssetsLength(assets);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    if (files.length === 0) return;
    setError(null);
    setIsAdding(true);
    const next: Record<string, string> = { ...assets };
    try {
      for (const file of files) {
        if (Object.keys(next).length >= MAX_THEME_ASSET_COUNT) {
          setError(`A theme can carry up to ${MAX_THEME_ASSET_COUNT} images.`);
          break;
        }
        if (!file.type.startsWith("image/")) {
          setError(`${file.name} is not an image.`);
          continue;
        }
        const budget = MAX_THEME_ASSETS_LENGTH - themeAssetsLength(next);
        const uri = await encodeThemeImage(file, budget);
        if (uri === null || !THEME_ASSET_DATA_URI_PATTERN.test(uri)) {
          setError(
            uri === null
              ? `${file.name} does not fit in the ${formatKb(budget)} left for images.`
              : `${file.name} is not a supported image type.`,
          );
          continue;
        }
        next[themeAssetNameFromFile(file.name, Object.keys(next))] = uri;
      }
    } catch {
      setError("Could not read that image.");
    } finally {
      setIsAdding(false);
    }
    if (Object.keys(next).length !== entries.length) onChange(next);
  };

  const remove = (name: string) => {
    const { [name]: _removed, ...rest } = assets;
    setError(null);
    onChange(rest);
  };

  return (
    <div className="space-y-2" data-testid="theme-assets-editor">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Images</p>
        <Button
          disabled={isAdding || entries.length >= MAX_THEME_ASSET_COUNT}
          onClick={() => inputRef.current?.click()}
          size="compact"
          variant="outline"
        >
          <ImagePlusIcon />
          {isAdding ? "Adding…" : "Add image"}
        </Button>
        <input
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
          className="hidden"
          multiple
          onChange={(event) => void handleFiles(event)}
          ref={inputRef}
          type="file"
        />
      </div>
      {entries.length > 0 ? (
        <ul className="space-y-1.5">
          {entries.map(([name, uri]) => (
            <li
              className="flex items-center gap-2 rounded-lg border border-border/70 p-1.5"
              key={name}
            >
              <img alt="" className="size-9 shrink-0 rounded-md object-cover" src={uri} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-foreground">{name}</p>
                <code className="block truncate font-mono text-2xs text-muted-foreground">
                  var({themeAssetVariable(name)})
                </code>
              </div>
              <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                {formatKb(uri.length)}
              </span>
              <Button
                aria-label={`Remove ${name}`}
                onClick={() => remove(name)}
                size="icon-xs"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Add a photo, then use it in CSS, e.g. background-image: var(--t3-asset-photo).
        </p>
      )}
      <p
        className={cn(
          "flex justify-between gap-3 text-xs",
          error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <span aria-live="polite">{error ?? "Photos are resized and saved inside the theme."}</span>
        <span className="shrink-0 tabular-nums">
          {formatKb(used)} / {formatKb(MAX_THEME_ASSETS_LENGTH)}
        </span>
      </p>
    </div>
  );
}
