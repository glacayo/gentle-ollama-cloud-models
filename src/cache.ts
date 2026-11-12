/**
 * Local cache for the Ollama Cloud catalog.
 *
 * Cached under the Pi agent dir: ~/.pi/agent/extensions/.ollama-cloud-cache.json
 * (best-effort; falls back to the same path inside PI_CODING_AGENT_DIR when set).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { CatalogCacheShape } from "./catalog.ts";

export function cacheFilePath(): string {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
  return join(agentDir, "extensions", ".ollama-cloud-cache.json");
}

export async function readCache(
  path: string = cacheFilePath(),
): Promise<CatalogCacheShape | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof (parsed as CatalogCacheShape).fetchedAt === "number" &&
      Array.isArray((parsed as CatalogCacheShape).models)
    ) {
      return parsed as CatalogCacheShape;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeCache(
  cache: CatalogCacheShape,
  path: string = cacheFilePath(),
): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(cache, null, 2));
  } catch {
    // Cache is best-effort; ignore write failures.
  }
}
