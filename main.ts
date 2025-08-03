import OGIAddon, { CustomTask, SearchTool, type BasicLibraryInfo, type SearchResult } from "ogi-addon";
import { join } from "path";
import fs from "fs";
import axios from "axios";
import { type GameData } from "./lib/types";

const addon = new OGIAddon({
  name: 'Steam Catalog',
  version: '1.0.0',
  id: 'steam-integration',
  author: 'OGI Team',
  description: 'An addon to integrate Steam store links into OpenGameInstaller',
  repository: 'https://github.com/Nat3z/steam-integration',
  storefronts: ['steam']
});

function stringSimilarity(a: string, b: string): number {
  // Normalize and clean the strings
  const normalize = (str: string): string => {
    return str
      .toLowerCase() 
      // Remove year patterns like (2023), [2024], etc.
      .replace(/[\(\[\{]\d{4}[\)\]\}]/g, '')
      // Remove edition suffixes but keep them for partial matching
      .replace(/\s+(premium|deluxe|gold|ultimate|complete|goty|game\s+of\s+the\s+year|enhanced|definitive|remastered|directors?\s+cut)\s+(edition)?/gi, '')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  const cleanA = normalize(a);
  const cleanB = normalize(b);

  // Return early for exact equality after normalization
  if (cleanA === cleanB) return 1;

  // Split into words for word-level matching
  const wordsA = cleanA.split(/\s+/).filter(word => word.length > 0);
  const wordsB = cleanB.split(/\s+/).filter(word => word.length > 0);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  // Calculate word-level similarity
  let exactMatches = 0;
  let partialMatches = 0;
  const usedWordsB = new Set<number>();

  for (const wordA of wordsA) {
    let bestMatch = 0;
    let bestMatchIndex = -1;

    for (let i = 0; i < wordsB.length; i++) {
      if (usedWordsB.has(i)) continue;

      const wordB = wordsB[i];
      
      // Exact word match
      if (wordA === wordB) {
        exactMatches++;
        usedWordsB.add(i);
        bestMatchIndex = i;
        break;
      }

      // Partial word match using character overlap
      const overlap = calculateCharacterOverlap(wordA, wordB);
      if (overlap > bestMatch && overlap > 0.6) {
        bestMatch = overlap;
        bestMatchIndex = i;
      }
    }

    // If we found a good partial match and haven't used exact match
    if (bestMatchIndex !== -1 && !usedWordsB.has(bestMatchIndex) && bestMatch > 0) {
      partialMatches++;
      usedWordsB.add(bestMatchIndex);
    }
  }

  // Calculate similarity score
  // Give more weight to exact matches, some weight to partial matches
  const totalWords = Math.max(wordsA.length, wordsB.length);
  const exactScore = exactMatches / totalWords;
  const partialScore = (partialMatches * 0.7) / totalWords;
  
  return Math.min(1, exactScore + partialScore);

  function calculateCharacterOverlap(str1: string, str2: string): number {
    if (str1.length < 2 || str2.length < 2) return str1 === str2 ? 1 : 0;
    
    const bigrams1 = new Set<string>();
    const bigrams2 = new Set<string>();
    
    for (let i = 0; i < str1.length - 1; i++) {
      bigrams1.add(str1.substring(i, i + 2));
    }
    
    for (let i = 0; i < str2.length - 1; i++) {
      bigrams2.add(str2.substring(i, i + 2));
    }
    
    const intersection = [...bigrams1].filter(bg => bigrams2.has(bg)).length;
    const union = bigrams1.size + bigrams2.size - intersection;
    
    return union > 0 ? intersection / union : 0;
  }
}

async function getRealGame(titleId: number): Promise<GameData | undefined> {
  // Add delay to prevent rate limiting
  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    const response = await axios({
      method: 'GET',
      url: `https://store.steampowered.com/api/appdetails?appids=${titleId}&cc=us`,
    });
    if (!response.data[titleId].success) {
      return undefined;
    }
    if (response.data[titleId].data.type === 'game') {
      return response.data[titleId].data;
    }

    // if (
    //   response.data[titleId].data.type === 'dlc' ||
    //   response.data[titleId].data.type === 'dlc_sub' ||
    //   response.data[titleId].data.type === 'music' ||
    //   response.data[titleId].data.type === 'video' ||
    //   response.data[titleId].data.type === 'episode'
    // ) {
    //   if (!response.data[titleId].data.fullgame) {
    //     return undefined;
    //   }
    //   return response.data[titleId].data.fullgame;
    // }
    // if (response.data[titleId].data.type === 'demo') {
    //   return response.data[titleId].data.fullgame;
    // }

    return undefined;
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

const steamAppSearcher = new SearchTool<{ appid: number; name: string }>([], ['appid', 'name'], {
  threshold: 0.3,
  includeScore: true
});

export async function getSteamApps(task: CustomTask) {
  if (fs.existsSync(join(__dirname, 'steam-apps.json'))) {
    const steamApps: {
      timeSinceUpdate: number;
      data: { appid: number; name: string }[];
    } = JSON.parse(
      fs.readFileSync(join(__dirname, 'steam-apps.json'), 'utf-8')
    );
    if (Date.now() - steamApps.timeSinceUpdate < 86400000) {
      //24 hours
      steamAppSearcher.addItems(steamApps.data);
      return;
    }
  }
  task.log('Downloading Steam apps');
  try {
    const response = await axios.get(
      'https://api.steampowered.com/ISteamApps/GetAppList/v0002/?key=STEAMKEY&format=json'
    );
    const steamApps = response.data.applist.apps;
    fs.writeFileSync(
      join(__dirname, 'steam-apps.json'),
      JSON.stringify({ timeSinceUpdate: Date.now(), data: steamApps }, null, 2)
    );
    steamAppSearcher.addItems(steamApps); 
  } catch (e) {
    task.fail('Failed to download Steam apps');
  }
}

addon.on('configure', (config) => config.addNumberOption(option => 
    option
      .setName('steam-limit')
      .setDisplayName('Steam Search Limit')
      .setDescription('The amount of steam apps that can be searched for at once. More results means more time to search.')
      .setMin(1)
      .setMax(100)
      .setDefaultValue(5)
      .setInputType('range')
  )
);

addon.on('connect', async () => {
  const task = await addon.task();
  // going to first download the steam apps
  task.log('Downloading Steam apps');
  await getSteamApps(task);
  task.log('Steam apps downloaded');
  task.finish();
});

addon.on('library-search', (query, event) => {
  event.defer(async () => {
    try {
      const results = await axios<SteamResult>({
        url: `https://store.steampowered.com/search/results/?term=${encodeURI(query)}&category1=${encodeURI('998,994')}&ignore_preferences=1&cc=us&json=1`,
        headers: {
          'User-Agent': 'OGI Steam-Integration/1.0.0'
        }
      });
      event.resolve(
        results.data.items
          .map(result => {
            const match = result.logo.match(/apps\/(\d+)/);
            if (!match) {
              return null;
            }
            const appID = parseInt(match[1]);
            return {
              appID: appID,
              name: result.name,
              storefront: 'steam',
              capsuleImage: `https://cdn.akamai.steamstatic.com/steam/apps/${appID}/header.jpg`,
              similarity: stringSimilarity(result.name, query)
            }
          })
          .filter(result => result && result.similarity >= 0.1)
          .sort((a, b) => b!.similarity - a!.similarity) // sort by most similar (ascending)
          .map((res) => {
            const { similarity, ...rest } = res!;
            return rest;
          }) // remove similarity from final result
      );
    } catch (e) {
      event.fail('Failed to search Steam');
      return;
    }
    
  });
});

addon.on('game-details', ({ appID, storefront }, event) => {
  event.defer(async () => {
    const realGame = await getRealGame(appID);
    if (realGame) {
      event.resolve({
        appID: realGame.steam_appid,
        name: realGame.name,
        capsuleImage: `https://steamcdn-a.akamaihd.net/steam/apps/${appID}/library_600x900_2x.jpg`,
        headerImage: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${realGame.steam_appid}/library_hero.jpg`,
        publishers: realGame.publishers,
        developers: realGame.developers,
        releaseDate: realGame.release_date.date,
        coverImage: `https://steamcdn-a.akamaihd.net/steam/apps/${realGame.steam_appid}/library_hero.jpg`,
        basicDescription: realGame.short_description,
        description: realGame.detailed_description
      });
    }
    event.fail('Game not found');
  });
});

function extractApps(items: { name: string; logo: string }[]): BasicLibraryInfo[] {
  return items.map(item => {
    const match = item.logo.match(/apps\/(\d+)/);
    if (!match) {
      return null;
    }
    const appID = parseInt(match[1]);
    return {
      name: item.name,
      capsuleImage: `https://cdn.akamai.steamstatic.com/steam/apps/${appID}/library_600x900_2x.jpg`,
      appID: appID,
      storefront: 'steam'
    }
  }).filter(app => app !== null);
}

type SteamResult = {
  desc: string;
  items: {
    name: string;
    logo: string
  }[]
}

addon.on('catalog', (event) => {
  event.defer(async () => {
    // search for global top sellers not f2p and a game
    const promises = await Promise.allSettled([
      // -- Top Sellers --
      new Promise(async (resolve, reject) => {
        axios<SteamResult>(`https://store.steampowered.com/search/results/?filter=globaltopsellers&ignore_preferences=1&json=1&hidef2p=1&category1=998`, {
          headers: {
            'User-Agent': 'OGI Steam-Integration/1.0.0'
          }
        }).then(data => 
          resolve([ 'top-sellers', 'Top Sellers', 'The best selling games on Steam', extractApps(data.data.items) ])
        ).catch(d => reject(d))

      }),
      // -- Roguelike --
      new Promise(async (resolve, reject) => {
        axios<SteamResult>(`https://store.steampowered.com/search/results/?filter=globaltopsellers&ignore_preferences=1&json=1&hidef2p=1&category1=998&tags=1716`, {
          headers: {
            'User-Agent': 'OGI Steam-Integration/1.0.0'
          },
        }).then(data =>
          resolve([ 'roguelike', 'Roguelike', 'Top Roguelike games on Steam', extractApps(data.data.items) ])
        ).catch(d => reject(d))
      }),
      // -- JRPGs --
      new Promise(async (resolve, reject) => {
        axios<SteamResult>(`https://store.steampowered.com/search/results/?filter=globaltopsellers&ignore_preferences=1&json=1&hidef2p=1&category1=998&tags=4434`, {
          headers: {
            'User-Agent': 'OGI Steam-Integration/1.0.0'
          },
        }).then(data =>
          resolve([ 'jrpg', 'JRPG', 'Top JRPG games on Steam', extractApps(data.data.items) ])
        ).catch(d => reject(d))
      }),
      // --
    ]);
    // filter out the promises that are not fulfilled
    const fulfilledPromises = promises.filter(promise => promise.status === 'fulfilled');
    // get the results from the fulfilled promises

    // first is the key, second is the name, third is the description, fourth is the listings
    const results = fulfilledPromises.map(promise => promise.value as [string, string, string, BasicLibraryInfo[]]);
    const catalogResults: Parameters<typeof event.resolve>[0] = {};
    for (const result of results) {
      catalogResults[result[0]] = {
        name: result[1],
        description: result[2],
        listings: result[3]
      };
    }
    event.resolve(catalogResults);
  });
});

addon.on('disconnect', () => {
  process.exit(0);
});

