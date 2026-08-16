import axios from "axios";
import type { BasicLibraryInfo } from "ogi-addon";

const STEAM_USER_AGENT = "OGI Steam-Integration/1.0.0";
const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

type SteamSearchResponse = {
  items: {
    name: string;
    logo: string;
  }[];
};

type SteamSuggestion = {
  appID: number;
  name: string;
  capsuleImage: string;
};

function decodeSteamHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(
      /&#(x?[0-9a-f]+);|&([a-z]+);/gi,
      (
        entity: string,
        numeric: string | undefined,
        named: string | undefined,
      ): string => {
        if (numeric) {
          const hexadecimal = numeric.toLowerCase().startsWith("x");
          const codePoint = Number.parseInt(
            hexadecimal ? numeric.slice(1) : numeric,
            hexadecimal ? 16 : 10,
          );
          return Number.isNaN(codePoint)
            ? entity
            : String.fromCodePoint(codePoint);
        }

        return HTML_ENTITIES[named?.toLowerCase() ?? ""] ?? entity;
      },
    )
    .trim();
}

export function parseSteamSuggestions(html: string): SteamSuggestion[] {
  const suggestions: SteamSuggestion[] = [];
  const suggestionPattern =
    /<a\b[^>]*data-ds-appid="(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(suggestionPattern)) {
    const name = match[2].match(
      /<div\b[^>]*class="match_name[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1];
    const capsuleImage = match[2].match(
      /<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')/i,
    );
    if (!name || !capsuleImage) {
      continue;
    }

    suggestions.push({
      appID: Number.parseInt(match[1], 10),
      name: decodeSteamHtml(name),
      capsuleImage: decodeSteamHtml(capsuleImage[1] ?? capsuleImage[2]),
    });
  }

  return suggestions;
}

function toLibraryInfo({
  appID,
  name,
  capsuleImage,
}: SteamSuggestion): BasicLibraryInfo {
  return {
    appID,
    name,
    storefront: "steam",
    capsuleImage,
  };
}

async function searchSteamStore(query: string): Promise<BasicLibraryInfo[]> {
  const response = await axios.get<SteamSearchResponse>(
    "https://store.steampowered.com/search/results/",
    {
      headers: { "User-Agent": STEAM_USER_AGENT },
      params: {
        term: query,
        category1: "998,994",
        ignore_preferences: 1,
        cc: "us",
        json: 1,
      },
    },
  );

  return response.data.items.flatMap((item): BasicLibraryInfo[] => {
    const match = item.logo.match(/apps\/(\d+)/);
    if (!match) {
      return [];
    }

    return [
      toLibraryInfo({
        appID: Number.parseInt(match[1], 10),
        name: decodeSteamHtml(item.name),
        capsuleImage: item.logo,
      }),
    ];
  });
}

export async function searchSteamLibrary(
  rawQuery: string,
): Promise<BasicLibraryInfo[]> {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  try {
    const response = await axios.get<string>(
      "https://store.steampowered.com/search/suggest",
      {
        headers: { "User-Agent": STEAM_USER_AGENT },
        params: {
          term: query,
          f: "games",
          cc: "us",
          l: "english",
          use_store_query: 1,
          use_search_spellcheck: 1,
        },
      },
    );
    const suggestions = parseSteamSuggestions(response.data);
    if (suggestions.length > 0) {
      return suggestions.map(toLibraryInfo);
    }
  } catch (error) {
    console.warn("Steam autocomplete search failed; using store search", error);
  }

  return searchSteamStore(query);
}
