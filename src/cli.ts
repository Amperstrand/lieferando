#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { LieferandoClient } from "./client.js";
import type { Menu, Venue } from "./types.js";

/**
 * Read-only CLI: `lieferando health <slug>`, `lieferando menu <slug>`.
 * No order command by design — no basket, no checkout, ever.
 */
export interface CliPorts {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  readonly fetchImpl?: typeof fetch;
}

const USAGE = `lieferando — read-only Lieferando storefront client

commands:
  health <slug>    venue identity + status from the menu manifest (no WAF)
  menu <slug>      full menu card set with prices

<slug> is the venue slug or any lieferando.de/speisekarte/<slug> URL.
Reads the open globalmenucdn JSON directly; never touches the app shell.
No order command exists by design.`;

function processPorts(): CliPorts {
  return {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  };
}

function printVenue(venue: Venue, out: (line: string) => void): void {
  out(`${venue.name} (unit ${venue.restaurantId})`);
  out(`  slug:      ${venue.slug}`);
  out(`  city:      ${venue.city ?? "unknown"}`);
  out(`  status:    ${venue.offline ? "OFFLINE (platform flag)" : "online"}`);
  out(`  tz:        ${venue.timezone}`);
  out(`  menu:      pushed ${venue.menuPushedAt || "unknown"} (version ${venue.menuVersion.slice(0, 8) || "?"}…)`);
  out(`  languages: ${venue.supportedLanguages.join(", ") || "default"}`);
}

function printMenu(menu: Menu, out: (line: string) => void): void {
  out(`${menu.venue.name} — ${menu.itemCount} items, ${menu.categories.length} categories (menu pushed ${menu.venue.menuPushedAt || "?"})`);
  if (menu.venue.offline) {
    out(`  (venue is flagged OFFLINE by the platform — menu may be stale)`);
  }
  for (const category of menu.categories) {
    out(`${category.name}  [${category.serviceTypes.join("/") || "delivery"}]`);
    for (const item of category.items) {
      const variable = item.variablePrice ? " (variable price)" : "";
      out(`  ${item.name}  ${item.price.toFixed(2)} EUR${variable}${item.variations > 1 ? `  (${item.variations} variants)` : ""}`);
    }
  }
}

export async function runCli(
  argv: readonly string[],
  ports: CliPorts = processPorts(),
): Promise<0 | 1> {
  const [command, target] = argv;
  if (command === undefined || command === "help" || command === "-h" || command === "--help") {
    ports.out(USAGE);
    return 0;
  }
  if (command !== "health" && command !== "menu") {
    ports.err(`unknown command: ${command}`);
    ports.err(USAGE);
    return 1;
  }
  if (target === undefined) {
    ports.err(`${command} needs a venue slug or lieferando.de URL`);
    return 1;
  }
  const client = new LieferandoClient(
    ports.fetchImpl === undefined ? {} : { fetchImpl: ports.fetchImpl },
  );
  try {
    if (command === "health") {
      const venue = await client.venue(target);
      if (venue === null) {
        ports.err(`no venue for ${target} (unknown slug — CDN 404)`);
        return 1;
      }
      printVenue(venue, ports.out);
      return venue.offline ? 1 : 0;
    }
    const menu = await client.menu(target);
    if (menu === null) {
      ports.err(`no menu for ${target} (unknown slug — CDN 404)`);
      return 1;
    }
    printMenu(menu, ports.out);
    return 0;
  } catch (error) {
    ports.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

// npm installs the bin as a .bin symlink while Node realpaths the ESM
// entry — compare resolved paths or the CLI silently no-ops for consumers.
function invokedAsScript(): boolean {
  if (process.argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (invokedAsScript()) {
  process.exit(await runCli(process.argv.slice(2)));
}
