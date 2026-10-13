import { describe, expect, it } from "vite-plus/test";

import { themeAssetNameFromFile, themeAssetsLength } from "./ThemeAssetsEditor";

describe("theme asset names", () => {
  it("derives a CSS-friendly name from the file name", () => {
    expect(themeAssetNameFromFile("Sunny Meadow.JPG", [])).toBe("sunny-meadow");
    expect(themeAssetNameFromFile("ISS_earth-limb.v2.webp", [])).toBe("iss-earth-limb-v2");
  });

  it("starts names with a letter and avoids names already taken", () => {
    expect(themeAssetNameFromFile("2024 sunrise.png", [])).toBe("image-2024-sunrise");
    expect(themeAssetNameFromFile("___.png", [])).toBe("image");
    expect(themeAssetNameFromFile("meadow.png", ["meadow", "meadow-2"])).toBe("meadow-3");
  });

  it("keeps names within the 32 character limit", () => {
    const name = themeAssetNameFromFile(`${"a".repeat(60)}.png`, [`${"a".repeat(28)}`]);
    expect(name).toBe(`${"a".repeat(28)}-2`);
    expect(name.length).toBeLessThanOrEqual(32);
  });

  it("measures the budget in data URI characters", () => {
    expect(themeAssetsLength({ a: "data:x", b: "data:yy" })).toBe(13);
  });
});
