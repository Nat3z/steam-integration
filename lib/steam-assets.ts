import type { SteamAppCommon, SteamImageSet } from "./types";

const STEAM_ASSET_BASE_URL = (appID: number): string =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appID}/`;

type SteamResolvedAssets = {
  capsuleImage?: string;
  headerImage?: string;
  heroImage?: string;
};

function getLocalizedImage(images?: Record<string, string>): string | undefined {
  if (!images) {
    return undefined;
  }

  return images.english ?? Object.values(images).find(Boolean);
}

function getImageFilename(asset?: SteamImageSet): string | undefined {
  return (
    getLocalizedImage(asset?.image2x) ?? getLocalizedImage(asset?.image)
  );
}

export function toSteamAssetUrl(appID: number, filename: string): string {
  if (/^https?:\/\//i.test(filename)) {
    return filename;
  }

  return STEAM_ASSET_BASE_URL(appID) + filename.replace(/^\/+/, "");
}

function resolveImage(
  appID: number,
  filename?: string,
): string | undefined {
  return filename ? toSteamAssetUrl(appID, filename) : undefined;
}

export function resolveSteamAssets(
  appID: number,
  common: SteamAppCommon,
): SteamResolvedAssets {
  const assets = common.library_assets_full;
  const headerImage = resolveImage(
    appID,
    getImageFilename(assets?.library_header) ??
      getLocalizedImage(common.header_image),
  );

  return {
    capsuleImage: resolveImage(
      appID,
      getImageFilename(assets?.library_capsule) ??
        getLocalizedImage(common.small_capsule),
    ),
    headerImage,
    heroImage:
      resolveImage(appID, getImageFilename(assets?.library_hero)) ?? headerImage,
  };
}
