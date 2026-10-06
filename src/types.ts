export type Slug = string & { readonly __brand: "Slug" };

/** Parse a venue slug: bare slug, or any lieferando.de menu URL form. */
export function slug(value: string): Slug {
  let candidate = value.trim();
  if (/^https?:\/\//i.test(candidate)) {
    const url = new URL(candidate);
    if (!/(^|\.)lieferando\.de$/.test(url.hostname)) {
      throw new Error(`not a lieferando.de URL: ${value}`);
    }
    const match = url.pathname.match(/\/(?:speisekarte|menu)\/([a-z0-9-]+)/i);
    if (match?.[1] === undefined) {
      throw new Error(`no venue slug in URL: ${value}`);
    }
    candidate = match[1];
  }
  if (!/^[a-z0-9][a-z0-9-]{1,}[a-z0-9]$/.test(candidate)) {
    throw new Error(`invalid slug: ${value}`);
  }
  return candidate.toLowerCase() as Slug;
}

/** Venue identity and status from the manifest. */
export interface Venue {
  readonly slug: Slug;
  readonly restaurantId: string;
  readonly name: string;
  readonly offline: boolean;
  readonly timezone: string;
  readonly city: string | null;
  /** Last menu push to the CDN — freshness of the whole read. */
  readonly menuPushedAt: string;
  readonly menuVersion: string;
  readonly supportedLanguages: readonly string[];
}

export interface MenuCategory {
  readonly id: string;
  readonly name: string;
  readonly serviceTypes: readonly string[];
  readonly items: readonly MenuItem[];
}

export interface MenuItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  /** First variation's base price in EUR; variable-price items flag it. */
  readonly price: number;
  readonly priceRaw: number;
  readonly variablePrice: boolean;
  readonly variations: number;
  readonly category: string;
}

export interface Menu {
  readonly venue: Venue;
  readonly categories: readonly MenuCategory[];
  readonly itemCount: number;
}
