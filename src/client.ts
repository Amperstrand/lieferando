import { LieferandoError } from "./error.js";
import { cdnUrl, fetchJson } from "./http.js";
import { menuFromPayloads, venueFromManifest, type RawItemsFile, type RawManifest } from "./menu.js";
import { slug as parseSlug, type Menu, type Slug, type Venue } from "./types.js";

export interface ClientOptions {
  readonly fetchImpl?: typeof fetch;
}

/**
 * Read-only Lieferando storefront client. Venue + menu reads from the
 * open globalmenucdn static JSON — this client never touches the
 * Cloudflare-guarded app shell. A thrown LieferandoError (reason
 * "network") means the CDN was unreachable; null always means the
 * platform answered: absent (unknown slug, 404).
 */
export class LieferandoClient {
  constructor(private readonly options: ClientOptions = {}) {}

  /** Venue identity + status from the self-describing manifest. */
  async venue(slugOrUrl: string): Promise<Venue | null> {
    const venueSlug = parseSlug(slugOrUrl);
    const manifest = await this.manifest(venueSlug);
    return manifest === null ? null : venueFromManifest(venueSlug, manifest);
  }

  /**
   * Full menu: manifest for identity/categories, then the items file the
   * manifest itself names (ItemsUrl) — no hardcoded second path.
   */
  async menu(slugOrUrl: string): Promise<Menu | null> {
    const venueSlug = parseSlug(slugOrUrl);
    const manifest = await this.manifest(venueSlug);
    if (manifest === null) return null;
    const itemsFile = manifest.ItemsUrl ?? `${venueSlug}_de_items.json`;
    const result = await fetchJson<RawItemsFile>(cdnUrl(itemsFile), this.options.fetchImpl);
    if (!result.ok) {
      if (result.kind === "network") {
        throw new LieferandoError("network", `items fetch failed: ${result.body}`);
      }
      return null;
    }
    return menuFromPayloads(venueSlug, manifest, result.value);
  }

  private async manifest(venueSlug: Slug): Promise<RawManifest | null> {
    const result = await fetchJson<RawManifest>(
      cdnUrl(`${venueSlug}_de_manifest.json`),
      this.options.fetchImpl,
    );
    if (!result.ok) {
      if (result.kind === "network") {
        throw new LieferandoError("network", `manifest fetch failed: ${result.body}`);
      }
      return null;
    }
    return result.value;
  }
}
