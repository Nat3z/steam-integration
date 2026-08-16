import { describe, expect, test } from "bun:test";
import { parseSteamSuggestions } from "./steam-search";

describe("Steam autocomplete parsing", () => {
  test("keeps the authoritative capsule URL returned by Steam", () => {
    const capsuleImage =
      "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2062430/1e8d4bf2436238c808fb805e2f4e3edd30d6b8b3/capsule_231x87_alt_assets_2.jpg?t=1786035856";
    const html = `<a data-ds-appid="2062430"><div class="match_name">BALL x PIT</div><div class="match_img"><img src="${capsuleImage}"></div></a>`;

    expect(parseSteamSuggestions(html)).toEqual([
      {
        appID: 2062430,
        name: "BALL x PIT",
        capsuleImage,
      },
    ]);
  });
});
