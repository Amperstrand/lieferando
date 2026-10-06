# AGENTS.md — contributing to lieferando

Read-only client for Lieferando (Just Eat Takeaway's German brand):
venue + menu reads from the open `globalmenucdn` static JSON — the
surface discovery lives in the private platform-recon repo's
`research/order-bridges/REPORT.md`. The client NEVER touches the
Cloudflare-guarded app shell; it reads the menu CDN only.

Rules:
- READ-ONLY: no accounts, no baskets, no orders, no payment. The legacy
  `/webservice/` API is robots-disallowed — out of lane entirely.
- This repository is public. Never commit card numbers, HAR/pcap/log
  files, cookies, session dumps, captured payloads, or personal data.
  Fakes are synthetic with provenance comments. Commit via
  `sh scripts/git-commit.sh`; CI runs the leak scan.
- Tests are offline against a synthetic fake that encodes the surface
  quirks (self-describing manifest, ItemsUrl indirection, variation
  pricing, per-language manifests, IsOffline, wrong-slug 404s).
