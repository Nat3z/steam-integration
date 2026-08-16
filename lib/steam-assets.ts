import axios from "axios";
import type { SteamAppCommon, SteamImageSet } from "./types";

const STEAM_STORE_ASSET_BASE_URL =
  "https://shared.akamai.steamstatic.com/store_item_assets/";
const STEAM_ASSET_BASE_URL = (appID: number): string =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appID}/`;
const STEAM_STORE_ITEMS_URL =
  "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/";
const STEAM_STORE_ITEMS_BATCH_SIZE = 50;

type SteamResolvedAssets = {
  capsuleImage?: string;
  headerImage?: string;
  heroImage?: string;
};

export type SteamStoreAssets = {
  asset_url_format: string;
  library_capsule?: string;
  library_capsule_2x?: string;
};

type SteamStoreItem = {
  appid: number;
  success: number;
  assets?: SteamStoreAssets;
};

type SteamStoreItemsResponse = {
  response: {
    store_items?: SteamStoreItem[];
  };
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

export function resolveSteamStoreAsset(
  assets: SteamStoreAssets,
): string | undefined {
  const filename = assets.library_capsule_2x ?? assets.library_capsule;
  if (!filename) {
    return undefined;
  }

  const path = assets.asset_url_format.replace("${FILENAME}", filename);
  return /^https?:\/\//i.test(path)
    ? path
    : STEAM_STORE_ASSET_BASE_URL + path.replace(/^\/+/, "");
}

export async function fetchSteamLibraryCapsules(
  appIDs: readonly number[],
): Promise<ReadonlyMap<number, string>> {
  const uniqueAppIDs = [...new Set(appIDs)];
  const batches: number[][] = [];
  for (
    let index = 0;
    index < uniqueAppIDs.length;
    index += STEAM_STORE_ITEMS_BATCH_SIZE
  ) {
    batches.push(
      uniqueAppIDs.slice(index, index + STEAM_STORE_ITEMS_BATCH_SIZE),
    );
  }

  const responses = await Promise.allSettled(
    batches.map(async (batch): Promise<SteamStoreItem[]> => {
      const response = await axios.get<SteamStoreItemsResponse>(
        STEAM_STORE_ITEMS_URL,
        {
          headers: { "User-Agent": "OGI Steam-Integration/1.0.0" },
          params: {
            input_json: JSON.stringify({
              ids: batch.map((appid): { appid: number } => ({ appid })),
              context: {
                language: "english",
                country_code: "US",
                steam_realm: 1,
              },
              data_request: { include_assets: true },
            }),
          },
        },
      );
      return response.data.response.store_items ?? [];
    }),
  );

  const capsules = new Map<number, string>();
  for (const response of responses) {
    if (response.status === "rejected") {
      console.warn("Steam library capsule lookup failed", response.reason);
      continue;
    }

    for (const item of response.value) {
      if (item.success !== 1 || !item.assets) {
        continue;
      }
      const capsuleImage = resolveSteamStoreAsset(item.assets);
      if (capsuleImage) {
        capsules.set(item.appid, capsuleImage);
      }
    }
  }

  return capsules;
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
