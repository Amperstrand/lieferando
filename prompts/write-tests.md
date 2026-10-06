---
description: Write the client test suite for a venue API. Fake the transport, encode the quirks, feed the lessons back.
---

Write tests for CLIENT against PLATFORM. The suite must pass offline, prove
the wire contract, and stay leak-gate clean.

## Principles

1. **Test through the public methods.** Inject the transport
   (`fetchImpl`). Never mock client internals.
2. **The fake is a router, not a per-test mock.** One
   `fake<Platform>()` factory that routes URLs and records every
   request. Assertions read the request log: the wire contract is the
   thing under test.
3. **One describe per endpoint, one test per documented quirk.**
4. **Encode surface semantics in the fake, not the test.** If the
   manifest names the items file, the fake serves items ONLY under
   that name — hardcoded second paths then fail naturally.
5. **Synthetic fixtures only.** Invented slugs, ids, prices; RFC 2606
   `example` hosts; a provenance comment saying so.
6. **Assert the read-only boundary.** Two polite GETs per menu read —
   assert the request count, not just the content.

## Lessons (append-only)

- The Lieferando menu CDN is open static JSON behind NO auth and NO
  WAF — but the app shell IS Cloudflare-gated. A client that reads
  only the CDN needs no impersonation at all; encode that boundary in
  the fake (unknown slugs get S3-style 404 XML, not HTML challenges).
- The manifest is self-describing (`ItemsUrl`): follow it in the
  client, enforce it in the fake — otherwise a path-rename on the
  platform side silently breaks the second request.
- Absence vs error splits on CONTENT-TYPE here: 404 + XML object-store
  error = unknown slug (null), 200 + JSON = data. The fake must serve
  the XML shape or the null contract is untested.
- Prices ride on `Variations[].BasePrice`, not on items — an extractor
  that reads item-level fields silently returns undefined for every
  price. The fixture keeps the price off the item to prove the join.
- Category membership is a MANY-to-many join
  (`Variations[].MenuGroupIds[]`): items can carry groups the manifest
  lacks (orphan rows) and manifests can carry groups with no items
  (empty cards). The fixture needs both or the filters are untested.
- `MessageSentTimestamp` is a freshness signal for the WHOLE read —
  surface it on the venue, not buried in the raw manifest.
- A venue-tangled fixture lies: when the "orphan group" quirk was
  first encoded, the fake ALSO put that group in the manifest, so the
  drop-path never ran and the test failed on a count. One quirk per
  fixture venue, or the fixtures cancel each other.
- Cross-fleet (see platform-recon research/LESSONS.md): the scaffold
  generator (platform-recon scripts/new-client.ts) now emits this
  package's conventions — regenerate rather than copy for the next
  provider; keep this file's per-quirk Lessons as the canonical detail.
- Parity lane: this package's items feed scripts/parity.ts via
  {title, price} adapters; a venue joined across GastroNova+Wolt
  showed systematic own-brand deltas — expect the same per venue.
