import { describe, expect, test } from "bun:test";
import {
  resolveSteamAssets,
  resolveSteamStoreAsset,
  toSteamAssetUrl,
} from "./steam-assets";
import type { SteamAppCommon } from "./types";

describe("Steam asset resolution", () => {
  test.each([
    {
      appID: 2062430,
      filename:
        "b6cabe1940c55119820eee4ed2d0b604bd5b3af4/library_600x900_2x.jpg",
    },
    {
      appID: 1867240,
      filename:
        "31dd6ce5538a3064749d769527656f9002a382b0/library_capsule_2x.jpg",
    },
  ])("preserves Steam's hashed path for $appID", ({ appID, filename }) => {
    expect(toSteamAssetUrl(appID, filename)).toBe(
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appID}/${filename}`,
    );
  });

  test("prefers localized 2x assets without assuming their filename", () => {
    const common: SteamAppCommon = {
      name: "WARDOGS",
      library_assets_full: {
        library_capsule: {
          image: {
            english:
              "31dd6ce5538a3064749d769527656f9002a382b0/library_capsule.jpg",
          },
          image2x: {
            english:
              "31dd6ce5538a3064749d769527656f9002a382b0/library_capsule_2x.jpg",
          },
        },
        library_header: {
          image: {
            english:
              "c4990e8713c1b3b7130845aadd51854f5abb9f7a/library_header.jpg",
          },
        },
        library_hero: {
          image: {
            english:
              "9e3d0dba457f3d33734990866160be80c399f67c/library_hero.jpg",
          },
        },
      },
    };

    expect(resolveSteamAssets(1867240, common)).toEqual({
      capsuleImage:
        "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1867240/31dd6ce5538a3064749d769527656f9002a382b0/library_capsule_2x.jpg",
      headerImage:
        "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1867240/c4990e8713c1b3b7130845aadd51854f5abb9f7a/library_header.jpg",
      heroImage:
        "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1867240/9e3d0dba457f3d33734990866160be80c399f67c/library_hero.jpg",
    });
  });

  test("keeps authoritative absolute fallback URLs intact", () => {
    const url =
      "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2062430/hash/capsule_231x87.jpg?t=1";

    expect(toSteamAssetUrl(2062430, url)).toBe(url);
  });

  test("selects the portrait library capsule from store browse assets", () => {
    expect(
      resolveSteamStoreAsset({
        asset_url_format: "steam/apps/1867240/${FILENAME}?t=1786467028",
        library_capsule:
          "31dd6ce5538a3064749d769527656f9002a382b0/library_capsule.jpg",
        library_capsule_2x:
          "31dd6ce5538a3064749d769527656f9002a382b0/library_capsule_2x.jpg",
      }),
    ).toBe(
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1867240/31dd6ce5538a3064749d769527656f9002a382b0/library_capsule_2x.jpg?t=1786467028",
    );
  });
});
