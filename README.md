# lieferando

Read-only client for [Lieferando](https://www.lieferando.de) (Just Eat
Takeaway's German brand). Venue + menu reads come from the open
`globalmenucdn` static JSON — unauthenticated, no cookies — so this
client **never touches the Cloudflare-guarded app shell**. Surface
discovery: the private platform-recon repo's `research/order-bridges/`
lane (the manifest is self-describing; see "What the client encodes").

Read-only by design: **no accounts, no baskets, no orders, no
payment**. The legacy `/webservice/` API is robots-disallowed and out
of lane entirely.

```sh
npm install github:Amperstrand/lieferando
```

```ts
import { LieferandoClient } from "lieferando";

const client = new LieferandoClient();
const venue = await client.venue("w-der-imbiss");   // slug or lieferando.de URL
const menu = await client.menu("w-der-imbiss");     // full priced catalog
```

CLI (Node 22+):

```sh
npx lieferando health w-der-imbiss
npx lieferando menu w-der-imbiss
```

## Error semantics

A thrown `LieferandoError` (reason `"network"`) means the CDN was
unreachable. A `null` return always means the platform answered:
absent — unknown slug (the object store serves S3-style 404 XML).

## What the client encodes

- The manifest is **self-describing**: `ItemsUrl` names the items
  file, so the second request follows the manifest instead of a
  hardcoded path; `MenuVersion` + `MessageSentTimestamp` expose menu
  freshness (the last push to the CDN).
- Prices live at `Items[].Variations[].BasePrice` (float EUR), not on
  items; `HasVariablePrice` flags market-priced rows; multi-variation
  items surface the variant count with the first variation's price.
- Category join: `Menus[].MenuGroupId` ↔ `Variations[].MenuGroupIds`;
  items whose groups the manifest lacks are dropped; empty categories
  are filtered.
- `RestaurantInfo.IsOffline` is the platform's own venue-off flag
  (surfaced by `health`, which exits 1 when offline).
- Per-language manifests exist (`SupportedLanguages[].ManifestUrl`);
  this client reads the default-language file.
- Two polite GETs per menu read — manifest, then items.

## Verification (live, 2026-10-06)

- **W-Der Imbiss (Berlin)**, slug `w-der-imbiss`: `venue` →
  `W-Der Imbiss`, restaurantId 2252408, menu pushed 2026-10-01;
  `menu` → 42 items across the category tree, prices from
  `Variations[].BasePrice`.
- **Sever Imbiss (Berlin)**, slug `sever-imbiss-wedding`: `venue` →
  restaurantId 13010976, menu pushed 2026-10-04 — freshness signal
  varies per venue as expected.

## Repo rules

Public repo — never commit captured payloads, cookies, or personal
data; fakes are synthetic with provenance comments. Commit via
`sh scripts/git-commit.sh`; CI runs the leak scan plus typecheck,
build, and the offline test suite. Test-writing thinking and the
quirk→lesson log live in [prompts/write-tests.md](prompts/write-tests.md).
