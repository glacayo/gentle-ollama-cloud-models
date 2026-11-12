#!/usr/bin/env node
// Regenerates src/catalog-snapshot.ts from the live Ollama Cloud catalog.
// Run before releases: npm run snapshot

import { writeFile } from "node:fs/promises";

const { fetchCatalog } = await import("../src/catalog.ts");

const models = await fetchCatalog({ concurrency: 6 });
if (models.length === 0) {
  console.error("✖ live catalog returned no models; refusing to overwrite the snapshot");
  process.exit(1);
}

const snapshot = { fetchedAt: Date.now(), models };
const body = `/**
 * Bundled Ollama Cloud catalog snapshot.
 *
 * Generated from the live https://ollama.com/v1/models catalog so the
 * provider has models immediately at startup (before the live refresh).
 * Regenerate with: npm run snapshot
 */

import type { CatalogCacheShape } from "./catalog.ts";

export const SNAPSHOT: CatalogCacheShape = ${JSON.stringify(snapshot, null, 2)} as CatalogCacheShape;
`;

await writeFile("src/catalog-snapshot.ts", body + "\n");
console.log(`✔ snapshot regenerated with ${models.length} models`);
