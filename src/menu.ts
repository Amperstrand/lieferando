import type { Menu, MenuCategory, MenuItem, Venue } from "./types.js";
import type { Slug } from "./types.js";

/**
 * Wire shapes of the globalmenucdn files. Quirks encoded (each maps to
 * a test + a Lessons line):
 *  - the manifest is SELF-DESCRIBING: ItemsUrl names the items file, so
 *    clients never hardcode the second path.
 *  - RestaurantInfo.IsOffline is the platform's own venue-off flag.
 *  - MessageSentTimestamp = last menu push (freshness of the read).
 *  - prices live at Items[].Variations[].BasePrice (float EUR), NOT on
 *    the item; HasVariablePrice flags market-priced items.
 *  - category join: Menus[].MenuGroupId ↔ Items[].Variations[].MenuGroupIds.
 *  - per-language manifests exist (SupportedLanguages[].ManifestUrl);
 *    this client reads the default-language file only.
 */
export interface RawManifest {
  readonly MenuVersion?: string;
  readonly RestaurantId?: string;
  readonly CountryCode?: string;
  readonly MessageSentTimestamp?: string;
  readonly ItemsUrl?: string;
  readonly TruncatedUrl?: string;
  readonly RestaurantInfo?: {
    readonly Name?: string;
    readonly IsOffline?: boolean;
    readonly TimeZone?: string;
    readonly Location?: {
      readonly City?: string;
    };
  };
  readonly Menus?: readonly {
    readonly MenuGroupId?: string;
    readonly Description?: string;
    readonly ServiceTypes?: readonly string[];
  }[];
  readonly SupportedLanguages?: readonly {
    readonly Language?: string;
    readonly ManifestUrl?: string;
  }[];
}

export interface RawItemsFile {
  readonly Items?: readonly {
    readonly Id?: string;
    readonly Name?: string;
    readonly Description?: string | null;
    readonly HasVariablePrice?: boolean;
    readonly Variations?: readonly {
      readonly BasePrice?: number;
      readonly MenuGroupIds?: readonly string[];
    }[];
  }[];
}

export function venueFromManifest(slug: Slug, manifest: RawManifest): Venue {
  return {
    slug,
    restaurantId: manifest.RestaurantId ?? "",
    name: manifest.RestaurantInfo?.Name ?? "",
    offline: manifest.RestaurantInfo?.IsOffline === true,
    timezone: manifest.RestaurantInfo?.TimeZone ?? "",
    city: manifest.RestaurantInfo?.Location?.City ?? null,
    menuPushedAt: manifest.MessageSentTimestamp ?? "",
    menuVersion: manifest.MenuVersion ?? "",
    supportedLanguages: (manifest.SupportedLanguages ?? [])
      .map((entry) => entry.Language)
      .filter((lang): lang is string => lang !== undefined),
  };
}

export function menuFromPayloads(
  slug: Slug,
  manifest: RawManifest,
  items: RawItemsFile,
): Menu {
  const venue = venueFromManifest(slug, manifest);
  const categoryNames = new Map<string, { name: string; serviceTypes: readonly string[] }>();
  const itemsByCategory = new Map<string, MenuItem[]>();
  for (const menu of manifest.Menus ?? []) {
    if (menu.MenuGroupId === undefined) continue;
    categoryNames.set(menu.MenuGroupId, {
      name: menu.Description && menu.Description !== "" ? menu.Description : menu.MenuGroupId,
      serviceTypes: menu.ServiceTypes ?? [],
    });
    itemsByCategory.set(menu.MenuGroupId, []);
  }

  let itemCount = 0;
  for (const item of items.Items ?? []) {
    const variation = item.Variations?.[0];
    if (variation === undefined) continue;
    const groupId = variation.MenuGroupIds?.find((id) => itemsByCategory.has(id));
    if (groupId === undefined) continue;
    const meta = categoryNames.get(groupId);
    if (meta === undefined) continue;
    const price = variation.BasePrice ?? 0;
    itemsByCategory.get(groupId)?.push({
      id: item.Id ?? "",
      name: item.Name ?? "",
      description: item.Description ?? null,
      price,
      priceRaw: price,
      variablePrice: item.HasVariablePrice === true,
      variations: item.Variations?.length ?? 0,
      category: meta.name,
    });
    itemCount += 1;
  }

  const categories: MenuCategory[] = [];
  for (const [id, meta] of categoryNames) {
    const entries = itemsByCategory.get(id);
    if (entries === undefined || entries.length === 0) continue;
    categories.push({ id, name: meta.name, serviceTypes: meta.serviceTypes, items: entries });
  }

  return {
    venue,
    categories,
    itemCount,
  };
}
