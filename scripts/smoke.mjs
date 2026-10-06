#!/usr/bin/env node
/**
 * Weekly smoke: read-only venue checks against the open menu CDN.
 * Exit 1 on drift, unknown slugs, or transport failure.
 */
import { LieferandoClient } from "../dist/index.js";

const WORKED_EXAMPLES = [
  { slug: "w-der-imbiss", name: "W-Der Imbiss (Berlin)" },
  { slug: "sever-imbiss-wedding", name: "Sever Imbiss (Berlin)" },
];

const client = new LieferandoClient();
let failed = false;

for (const example of WORKED_EXAMPLES) {
  try {
    const venue = await client.venue(example.slug);
    if (venue === null) {
      console.error(`smoke fail ${example.slug} (${example.name}): CDN answered absent`);
      failed = true;
    } else {
      console.log(
        `smoke pass ${example.slug} (${example.name}): ${venue.name} id=${venue.restaurantId} offline=${venue.offline} pushed=${venue.menuPushedAt}`,
      );
    }
  } catch (error) {
    console.error(`smoke fail ${example.slug} (${example.name}): ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

try {
  const menu = await client.menu(WORKED_EXAMPLES[0]?.slug ?? "");
  if (menu === null || menu.itemCount === 0) {
    console.error(`smoke fail menu read: ${menu === null ? "null" : "zero items"}`);
    failed = true;
  } else {
    console.log(`smoke pass menu read: ${menu.itemCount} items, ${menu.categories.length} categories`);
  }
} catch (error) {
  console.error(`smoke fail menu read: ${error instanceof Error ? error.message : String(error)}`);
  failed = true;
}

process.exit(failed ? 1 : 0);
