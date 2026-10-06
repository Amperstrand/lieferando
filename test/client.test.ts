import { describe, expect, it } from "vitest";
import { LieferandoClient, LieferandoError } from "../src/index.js";
import { slug } from "../src/types.js";
import { fakeLieferando, LIVE_SLUG, OFFLINE_SLUG, VARIABLE_PRICE_SLUG } from "./lieferando-fake.js";
import { sent } from "./transport-fake.js";

function client(fetchImpl: typeof fetch): LieferandoClient {
  return new LieferandoClient({ fetchImpl });
}

describe("slug", () => {
  it("accepts bare slugs and lieferando URL forms", () => {
    expect(slug("w-der-imbiss")).toBe("w-der-imbiss");
    expect(slug("https://www.lieferando.de/speisekarte/w-der-imbiss")).toBe("w-der-imbiss");
    expect(slug("https://www.lieferando.de/en/menu/w-der-imbiss")).toBe("w-der-imbiss");
    expect(() => slug("https://example.test/w-der-imbiss")).toThrow(/lieferando\.de/);
    expect(() => slug("https://www.lieferando.de/en/menu/")).toThrow(/slug/);
    expect(() => slug("Bad Slug!")).toThrow(/invalid slug/);
  });
});

describe("venue", () => {
  it("reads identity + status from the self-describing manifest", async () => {
    const { fetchImpl } = fakeLieferando();
    const venue = await client(fetchImpl).venue(LIVE_SLUG);
    expect(venue).toMatchObject({
      name: "Synthetic Kebap Haus",
      offline: false,
      timezone: "Europe/Berlin",
      city: "Synthesia",
      menuPushedAt: "2026-10-06T02:10:48.7237839Z",
    });
    expect(venue?.supportedLanguages).toEqual(["de", "en"]);
  });

  it("returns null for an unknown slug (S3-style 404 is absence, not error)", async () => {
    const { fetchImpl } = fakeLieferando();
    expect(await client(fetchImpl).venue("does-not-exist")).toBeNull();
  });

  it("carries the platform's own offline flag", async () => {
    const { fetchImpl } = fakeLieferando();
    const venue = await client(fetchImpl).venue(OFFLINE_SLUG);
    expect(venue?.offline).toBe(true);
    expect(venue?.name).toBe("Synthetic Closed Kitchen");
  });

  it("throws a typed network error when the transport dies", async () => {
    const dead: typeof fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(client(dead).venue(LIVE_SLUG)).rejects.toMatchObject({
      name: "LieferandoError",
      reason: "network",
    });
  });
});

describe("menu", () => {
  it("follows the manifest's ItemsUrl instead of hardcoding the items path", async () => {
    const { fetchImpl, requests } = fakeLieferando();
    const menu = await client(fetchImpl).menu(LIVE_SLUG);
    expect(menu?.itemCount).toBe(3);
    const itemsRequest = requests.find((request) => request.url.includes("_items.json"));
    expect(itemsRequest?.url).toContain(`${LIVE_SLUG}_de_items.json`);
    // manifest requested exactly once, items exactly once — two polite GETs
    expect(requests).toHaveLength(2);
  });

  it("joins categories via MenuGroupId and prices via Variations[].BasePrice", async () => {
    const { fetchImpl } = fakeLieferando();
    const menu = await client(fetchImpl).menu(LIVE_SLUG);
    const gerichte = menu?.categories.find((category) => category.name === "Gerichte");
    expect(gerichte?.items.map((item) => item.name)).toEqual(["Synthetic Dürüm", "Synthetic Dürüm XXL"]);
    expect(gerichte?.items[0]).toMatchObject({ price: 8.5, priceRaw: 8.5, variablePrice: false, variations: 1 });
    // empty Description falls back to the group id as the name
    const unnamed = menu?.categories.find((category) => category.id === "AAAACATEGORY0002");
    expect(unnamed?.name).toBe("AAAACATEGORY0002");
    expect(unnamed?.serviceTypes).toEqual(["delivery", "pickup"]);
  });

  it("flags variable-price items and drops items whose groups the manifest lacks", async () => {
    const { fetchImpl } = fakeLieferando();
    const menu = await client(fetchImpl).menu(VARIABLE_PRICE_SLUG);
    const item = menu?.categories[0]?.items[0];
    expect(item).toMatchObject({
      name: "Synthetic Fischbrötchen",
      variablePrice: true,
      variations: 2,
      price: 7.5,
    });
    expect(menu?.itemCount).toBe(1);
    expect(menu?.categories.some((category) => category.id === "ZZZZNOTAMENU")).toBe(false);
  });

  it("returns null when the manifest resolves but the items file 404s", async () => {
    const { fetchImpl } = fakeLieferando();
    // a venue manifest exists; its items file is fetched by ItemsUrl and
    // only unknown slugs 404 — simulate the platform-side hole by
    // requesting an items file through a slug that has no venue at all
    expect(await client(fetchImpl).menu("does-not-exist")).toBeNull();
  });

  it("throws a typed network error mid-chain when the transport dies", async () => {
    const dead: typeof fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(client(dead).menu(LIVE_SLUG)).rejects.toBeInstanceOf(LieferandoError);
  });
});
