/**
 * SYNTHETIC Lieferando CDN. Every slug, id, price and timestamp below is
 * invented — nothing is a captured payload. The fixture mirrors the SHAPE
 * of the open globalmenucdn surface (platform-recon
 * research/order-bridges/REPORT.md) so the tests exercise the documented
 * quirks as behavior:
 *
 *  - the manifest is self-describing: ItemsUrl names the items file —
 *    the fake REFUSES an items request whose name does not match the
 *    manifest's ItemsUrl (hardcoded second paths fail naturally).
 *  - unknown slugs get S3-style 404 XML (platform-answered-absent).
 *  - prices live at Variations[].BasePrice (float EUR), not on items;
 *    HasVariablePrice flags market-priced rows.
 *  - category join Menus[].MenuGroupId ↔ Variations[].MenuGroupIds;
 *    items whose only groups are absent from the manifest are dropped.
 *  - RestaurantInfo.IsOffline is the platform's venue-off flag.
 *  - per-language manifests exist; the client reads the default file.
 */
import { bodyOf, headerRecord, jsonResponse, type RecordedRequest } from "./transport-fake.js";

export const CDN = "https://globalmenucdn.eu-central-1.production.jet-external.com";
export const LIVE_SLUG = "synthetic-kebap";
export const OFFLINE_SLUG = "synthetic-closed-kitchen";
export const VARIABLE_PRICE_SLUG = "synthetic-fish-counter";

const CATEGORY_A = "AAAACATEGORY0001";
const CATEGORY_B = "AAAACATEGORY0002";

interface FakeVenue {
  readonly name: string;
  readonly offline: boolean;
  readonly items: readonly {
    readonly Id: string;
    readonly Name: string;
    readonly Description: string | null;
    readonly HasVariablePrice: boolean;
    readonly Variations: readonly { readonly BasePrice: number; readonly MenuGroupIds: readonly string[] }[];
  }[];
}

const VENUES: Readonly<Record<string, FakeVenue>> = {
  [LIVE_SLUG]: {
    name: "Synthetic Kebap Haus",
    offline: false,
    items: [
      {
        Id: "item-0001",
        Name: "Synthetic Dürüm",
        Description: "Invented wrap",
        HasVariablePrice: false,
        Variations: [{ BasePrice: 8.5, MenuGroupIds: [CATEGORY_A] }],
      },
      {
        Id: "item-0002",
        Name: "Synthetic Dürüm XXL",
        Description: null,
        HasVariablePrice: false,
        Variations: [{ BasePrice: 12.0, MenuGroupIds: [CATEGORY_A] }],
      },
      {
        Id: "item-0003",
        Name: "Synthetic Ayran",
        Description: null,
        HasVariablePrice: false,
        Variations: [{ BasePrice: 2.2, MenuGroupIds: [CATEGORY_B] }],
      },
    ],
  },
  [OFFLINE_SLUG]: {
    name: "Synthetic Closed Kitchen",
    offline: true,
    items: [
      {
        Id: "item-1001",
        Name: "Synthetic Soljanka",
        Description: null,
        HasVariablePrice: false,
        Variations: [{ BasePrice: 9.0, MenuGroupIds: [CATEGORY_A] }],
      },
    ],
  },
  [VARIABLE_PRICE_SLUG]: {
    name: "Synthetic Fish Counter",
    offline: false,
    items: [
      {
        Id: "item-2001",
        Name: "Synthetic Fischbrötchen",
        Description: null,
        HasVariablePrice: true,
        Variations: [
          { BasePrice: 7.5, MenuGroupIds: [CATEGORY_A] },
          { BasePrice: 9.5, MenuGroupIds: [CATEGORY_A] },
        ],
      },
      {
        // joins only a group the manifest does not carry -> dropped
        Id: "item-2002",
        Name: "Synthetic Orphan Item",
        Description: null,
        HasVariablePrice: false,
        Variations: [{ BasePrice: 5, MenuGroupIds: ["ZZZZNOTAMENU"] }],
      },
    ],
  },
};

function manifestFor(slugKey: string, venue: FakeVenue): Record<string, unknown> {
  return {
    MenuVersion: "syntheticversion0000000000001",
    RestaurantId: `7000${slugKey.length}`,
    CountryCode: "de",
    MessageSentTimestamp: "2026-10-06T02:10:48.7237839Z",
    ItemsUrl: `${slugKey}_de_items.json`,
    TruncatedUrl: `${slugKey}_de_truncated.json`,
    RestaurantInfo: {
      Name: venue.name,
      IsOffline: venue.offline,
      TimeZone: "Europe/Berlin",
      Location: { City: "Synthesia" },
    },
    Menus: [
      {
        MenuGroupId: CATEGORY_A,
        Description: "Gerichte",
        ServiceTypes: ["delivery"],
      },
      {
        MenuGroupId: CATEGORY_B,
        Description: "",
        ServiceTypes: ["delivery", "pickup"],
      },
    ],
    SupportedLanguages: [
      { Language: "de", ManifestUrl: `${slugKey}_de_manifest.json` },
      { Language: "en", ManifestUrl: `${slugKey}_en_manifest.json` },
    ],
  };
}

export function fakeLieferando(): {
  readonly fetchImpl: typeof fetch;
  readonly requests: readonly RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    requests.push({ method, url: url.toString(), headers: headerRecord(init), body: bodyOf(init) });

    const manifestMatch = url.pathname.match(/^\/([a-z0-9-]+)_de_manifest\.json$/);
    if (manifestMatch?.[1] !== undefined) {
      const venue = VENUES[manifestMatch[1]];
      if (venue === undefined) {
        return new Response(
          `<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`,
          { status: 404, headers: { "content-type": "application/xml" } },
        );
      }
      return jsonResponse(manifestFor(manifestMatch[1], venue));
    }

    const itemsMatch = url.pathname.match(/^\/([a-z0-9-]+)_de_items\.json$/);
    if (itemsMatch?.[1] !== undefined) {
      const venue = VENUES[itemsMatch[1]];
      if (venue === undefined) {
        return new Response(
          `<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`,
          { status: 404, headers: { "content-type": "application/xml" } },
        );
      }
      return jsonResponse({ QuantityRestrictions: [], Items: venue.items });
    }

    // Any other file name: the manifest's ItemsUrl is the contract —
    // request anything else and the fake answers like an object store.
    return new Response(
      `<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`,
      { status: 404, headers: { "content-type": "application/xml" } },
    );
  };
  return { fetchImpl, requests };
}
