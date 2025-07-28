import OGIAddon, { SearchTool, type BasicLibraryInfo, type SearchResult } from "ogi-addon";
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


function extractSimpleName(input: string) {
  // Regular expression to match the game name
  const regex = /^(.+?)([:\-–])/;
  const match = input.match(regex);
  return match ? match[1].trim() : null;
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

export async function getSteamApps() {
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
  const response = await axios.get(
    'https://api.steampowered.com/ISteamApps/GetAppList/v0002/?key=STEAMKEY&format=json'
  );
  const steamApps = response.data.applist.apps;
  fs.writeFileSync(
    join(__dirname, 'steam-apps.json'),
    JSON.stringify({ timeSinceUpdate: Date.now(), data: steamApps }, null, 2)
  );
  steamAppSearcher.addItems(steamApps);
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
  await getSteamApps();
  task.log('Steam apps downloaded');
  task.finish();
});

addon.on('library-search', (query, event) => {
  event.defer(async () => {
    const results = steamAppSearcher.search(query, addon.config.getNumberValue('steam-limit'));
    const realResults = await Promise.allSettled(results.map(async result => {
      const realGame = await getRealGame(result.appid);
      if (realGame) {
        return realGame;
      }
      return undefined;
    }));

    const resolvedResults = realResults.filter(result => result.status === 'fulfilled').filter(result => result.value);
    // filter duplicates
    const uniqueResults = resolvedResults.filter((result, index, self) =>
      index === self.findIndex((t) => t.value!.steam_appid === result.value!.steam_appid)
    );
    event.resolve(
      uniqueResults.map(result => ({
        appID: result.value!.steam_appid,
        name: result.value!.name,
        storefront: 'steam',
        capsuleImage: `https://cdn.akamai.steamstatic.com/steam/apps/${result.value!.steam_appid}/header.jpg`
      }))
    );
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

