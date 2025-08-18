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
      // Remove trademark symbols (™, ®, ©, etc.)
      .replace(/[™®©℠]/g, '')
      // Remove year patterns like (2023), [2024], etc.
      .replace(/[\(\[\{]\d{4}[\)\]\}]/g, '')
      // Remove common gaming suffixes and prefixes
      .replace(/\s+(premium|deluxe|gold|ultimate|complete|goty|game\s+of\s+the\s+year|enhanced|definitive|remastered|directors?\s+cut|collectors?\s+edition|special\s+edition|digital\s+edition)\s*(edition)?/gi, '')
      // Remove "the" at the beginning for better matching
      .replace(/^the\s+/i, '')
      // Normalize Roman numerals to Arabic numbers for better matching
      .replace(/\biv\b/gi, '4')
      .replace(/\biii\b/gi, '3') 
      .replace(/\bii\b/gi, '2')
      .replace(/\bvi\b/gi, '6')
      .replace(/\bvii\b/gi, '7')
      .replace(/\bviii\b/gi, '8')
      .replace(/\bix\b/gi, '9')
      .replace(/\bxi\b/gi, '11')
      .replace(/\bxii\b/gi, '12')
      // Handle common abbreviations
      .replace(/\b&\b/g, 'and')
      .replace(/\bvs\b/gi, 'versus')
      // Clean up extra whitespace and punctuation
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const cleanA = normalize(a);
  const cleanB = normalize(b);

  // Return early for exact equality after normalization
  if (cleanA === cleanB) return 1;

  // Split into words for word-level matching
  const wordsA = cleanA.split(/\s+/).filter(word => word.length > 1); // Filter out single characters
  const wordsB = cleanB.split(/\s+/).filter(word => word.length > 1);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  // Filter out extremely common words that shouldn't contribute much to similarity
  const commonWords = new Set(['the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by']);
  const significantWordsA = wordsA.filter(word => !commonWords.has(word) || word.length > 4);
  const significantWordsB = wordsB.filter(word => !commonWords.has(word) || word.length > 4);

  // If no significant words remain, fall back to all words but with lower threshold
  const finalWordsA = significantWordsA.length > 0 ? significantWordsA : wordsA;
  const finalWordsB = significantWordsB.length > 0 ? significantWordsB : wordsB;

  // Calculate word-level similarity with stricter matching
  let exactMatches = 0;
  let strongPartialMatches = 0;
  let weakPartialMatches = 0;
  const usedWordsB = new Set<number>();

  for (const wordA of finalWordsA) {
    let bestMatch = 0;
    let bestMatchIndex = -1;
    let matchType = 'none';

    for (let i = 0; i < finalWordsB.length; i++) {
      if (usedWordsB.has(i)) continue;

      const wordB = finalWordsB[i];
      
      // Exact word match
      if (wordA === wordB) {
        exactMatches++;
        usedWordsB.add(i);
        bestMatchIndex = i;
        matchType = 'exact';
        break;
      }

      // Check for substring matches (useful for abbreviated titles) - but more strict
      if (wordA.length >= 4 && wordB.length >= 4) {
        if (wordA.includes(wordB) || wordB.includes(wordA)) {
          const similarity = Math.min(wordA.length, wordB.length) / Math.max(wordA.length, wordB.length);
          if (similarity > bestMatch && similarity > 0.8) { // Increased threshold
            bestMatch = similarity;
            bestMatchIndex = i;
            matchType = 'strong';
          }
        }
      }

      // Fuzzy character overlap matching - stricter threshold
      const overlap = calculateJaccardSimilarity(wordA, wordB);
      if (overlap > bestMatch && overlap > 0.75) { // Increased threshold
        bestMatch = overlap;
        bestMatchIndex = i;
        matchType = 'strong';
      }

      // Levenshtein-based similarity for close matches - stricter threshold
      const levenshtein = calculateLevenshteinSimilarity(wordA, wordB);
      if (levenshtein > bestMatch && levenshtein > 0.8) { // Increased threshold
        bestMatch = levenshtein;
        bestMatchIndex = i;
        matchType = levenshtein > 0.9 ? 'strong' : 'weak';
      }
    }

    // Categorize matches by strength
    if (bestMatchIndex !== -1 && !usedWordsB.has(bestMatchIndex) && bestMatch > 0) {
      if (matchType === 'strong') {
        strongPartialMatches += bestMatch;
      } else if (matchType === 'weak') {
        weakPartialMatches += bestMatch * 0.5; // Heavily penalize weak matches
      }
      usedWordsB.add(bestMatchIndex);
    }
  }

  // Calculate similarity score with stricter weighting
  const totalWords = Math.max(finalWordsA.length, finalWordsB.length);
  const exactScore = exactMatches / totalWords;
  const strongPartialScore = (strongPartialMatches / totalWords) * 0.7; // Reduced weight
  const weakPartialScore = (weakPartialMatches / totalWords) * 0.3; // Very low weight
  
  // Require minimum number of matches for longer queries
  const minWordsMatched = exactMatches + Math.floor(strongPartialMatches) + Math.floor(weakPartialMatches);
  const minRequiredMatches = Math.min(2, Math.floor(finalWordsA.length * 0.6)); // At least 60% of words should match
  
  if (minWordsMatched < minRequiredMatches) {
    return 0; // Not enough matches, return 0
  }

  // Bonus for length similarity (helps with abbreviated vs full titles) - reduced
  const lengthSimilarity = Math.min(cleanA.length, cleanB.length) / Math.max(cleanA.length, cleanB.length);
  const lengthBonus = lengthSimilarity * 0.05; // Reduced bonus
  
  const totalScore = exactScore + strongPartialScore + weakPartialScore + lengthBonus;
  
  // Apply stricter threshold - require higher minimum score
  return totalScore < 0.3 ? 0 : Math.min(1, totalScore);

  function calculateJaccardSimilarity(str1: string, str2: string): number {
    if (str1.length < 2 || str2.length < 2) return str1 === str2 ? 1 : 0;
    
    const shingles1 = new Set<string>();
    const shingles2 = new Set<string>();
    
    // Use character trigrams for better accuracy
    const shingleSize = Math.min(3, Math.min(str1.length, str2.length));
    
    for (let i = 0; i <= str1.length - shingleSize; i++) {
      shingles1.add(str1.substring(i, i + shingleSize));
    }
    
    for (let i = 0; i <= str2.length - shingleSize; i++) {
      shingles2.add(str2.substring(i, i + shingleSize));
    }
    
    const intersection = [...shingles1].filter(sh => shingles2.has(sh)).length;
    const union = shingles1.size + shingles2.size - intersection;
    
    return union > 0 ? intersection / union : 0;
  }

  function calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength > 0 ? 1 - distance / maxLength : 1;
  }
}

function calculateSortScore(title: string, query: string, baseSimilarity: number): number {
  const normalizeForSort = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[™®©℠]/g, '')
      .replace(/[\(\[\{]\d{4}[\)\]\}]/g, '')
      .replace(/\s+(premium|deluxe|gold|ultimate|complete|goty|game\s+of\s+the\s+year|enhanced|definitive|remastered|directors?\s+cut|collectors?\s+edition|special\s+edition|digital\s+edition)\s*(edition)?/gi, '')
      .replace(/^the\s+/i, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const cleanTitle = normalizeForSort(title);
  const cleanQuery = normalizeForSort(query);
  
  let sortScore = baseSimilarity;
  
  // Bonus for exact title match (after normalization)
  if (cleanTitle === cleanQuery) {
    return 1.0;
  }
  
  // Bonus for title starting with query (strong indicator of main game vs spin-off)
  if (cleanTitle.startsWith(cleanQuery)) {
    sortScore += 0.3;
  }
  
  // Bonus for query being a complete substring of title
  if (cleanTitle.includes(cleanQuery)) {
    sortScore += 0.2;
  }
  
  // Split into words for more detailed analysis
  const titleWords = cleanTitle.split(/\s+/);
  const queryWords = cleanQuery.split(/\s+/);
  
  // Bonus for maintaining word order (important for sequels)
  let orderBonus = 0;
  let lastFoundIndex = -1;
  let consecutiveMatches = 0;
  
  for (const queryWord of queryWords) {
    const foundIndex = titleWords.findIndex((titleWord, index) => 
      index > lastFoundIndex && (
        titleWord === queryWord || 
        titleWord.includes(queryWord) || 
        queryWord.includes(titleWord)
      )
    );
    
    if (foundIndex !== -1) {
      if (foundIndex === lastFoundIndex + 1) {
        consecutiveMatches++;
      }
      lastFoundIndex = foundIndex;
    }
  }
  
  orderBonus = (consecutiveMatches / Math.max(queryWords.length, 1)) * 0.2;
  sortScore += orderBonus;
  
  // Special handling for numbers and Roman numerals (important for game series)
  const numberPattern = /\b(\d+|iv|iii|ii|vi|vii|viii|ix|xi|xii|v)\b/gi;
  const queryNumbers = cleanQuery.match(numberPattern) || [];
  const titleNumbers = cleanTitle.match(numberPattern) || [];
  
  if (queryNumbers.length > 0) {
    // Normalize Roman numerals for comparison
    const normalizeNumber = (num: string): string => {
      const romanMap: { [key: string]: string } = {
        'iv': '4', 'iii': '3', 'ii': '2', 'vi': '6', 'vii': '7', 
        'viii': '8', 'ix': '9', 'xi': '11', 'xii': '12', 'v': '5'
      };
      return romanMap[num.toLowerCase()] || num;
    };
    
    const normalizedQueryNumbers = queryNumbers.map(normalizeNumber);
    const normalizedTitleNumbers = titleNumbers.map(normalizeNumber);
    
    // Exact number match bonus
    const numberMatches = normalizedQueryNumbers.filter(qNum => 
      normalizedTitleNumbers.includes(qNum)
    ).length;
    
    if (numberMatches === queryNumbers.length && numberMatches > 0) {
      sortScore += 0.25; // Strong bonus for exact number/numeral matches
    }
    
    // Penalty for titles with different numbers (likely different games in series)
    const hasConflictingNumbers = normalizedTitleNumbers.some(tNum => 
      normalizedQueryNumbers.length > 0 && 
      !normalizedQueryNumbers.includes(tNum) && 
      /^\d+$/.test(tNum)
    );
    
    if (hasConflictingNumbers) {
      sortScore -= 0.3; // Penalty for conflicting numbers
    }
  }
  
  // Penalty for generic terms that might indicate spin-offs
  const genericTerms = ['online', 'mobile', 'legends', 'heroes', 'chronicles', 'tales', 'stories', 'collection'];
  const titleHasGeneric = genericTerms.some(term => cleanTitle.includes(term));
  const queryHasGeneric = genericTerms.some(term => cleanQuery.includes(term));
  
  if (titleHasGeneric && !queryHasGeneric) {
    sortScore -= 0.15; // Penalty for spin-offs when not specifically searched
  }
  
  // Length penalty for overly long titles (often special editions or bundles)
  const lengthRatio = cleanTitle.length / cleanQuery.length;
  if (lengthRatio > 2.5) {
    sortScore -= 0.1;
  }
  
  return Math.max(0, Math.min(1, sortScore));
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
            const similarity = stringSimilarity(result.name, query);
            const sortScore = calculateSortScore(result.name, query, similarity);
            return {
              appID: appID,
              name: result.name,
              storefront: 'steam',
              capsuleImage: `https://cdn.akamai.steamstatic.com/steam/apps/${appID}/header.jpg`,
              similarity: similarity,
              sortScore: sortScore
            }
          })
          .filter(result => result && result.similarity >= 0.1)
          .sort((a, b) => b!.sortScore - a!.sortScore) // sort by enhanced sort score
          .map((res) => {
            const { similarity, sortScore, ...rest } = res!;
            return rest;
          }) // remove similarity and sortScore from final result
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

