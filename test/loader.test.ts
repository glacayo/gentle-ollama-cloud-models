/**
 * Unit tests for the Ollama Cloud loader state machine
 * (cache handling, TTL, stale fallback, register/retry/refresh).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createCloudLoader,
  registerModels,
  type CloudLoaderDeps,
  type CloudModelDef,
} from "../extensions/ollama-cloud.ts";

const NOW = 10_000_000_000; // ~3.17 months in ms: fetchedAt 0 is always stale

function makeModels(ids: string[]): CloudModelDef[] {
  return ids.map((id) => ({
    id,
    slug: id,
    name: id,
    reasoning: true,
    input: ["text"] as const,
    contextWindow: 131072,
    maxTokens: 32768,
    capabilities: ["thinking"],
  }));
}

interface RecordedStatus {
  status: "loading" | "ready" | "failed";
  detail: string;
}

function makeDeps(overrides: Partial<CloudLoaderDeps> = {}): CloudLoaderDeps & {
  registered: CloudModelDef[][];
  statuses: RecordedStatus[];
  cache: { fetchedAt: number; models: CloudModelDef[] } | null;
} {
  const registered: CloudModelDef[][] = [];
  const statuses: RecordedStatus[] = [];
  let cache: { fetchedAt: number; models: CloudModelDef[] } | null = null;
  const deps: CloudLoaderDeps & {
    registered: CloudModelDef[][];
    statuses: RecordedStatus[];
    cache: { fetchedAt: number; models: CloudModelDef[] } | null;
  } = {
    readCache: async () => cache,
    writeCache: async (c) => {
      cache = c;
    },
    fetch: async () => makeModels(["fetched-a", "fetched-b"]),
    register: (models) => registered.push(models),
    now: () => NOW,
    setStatus: (status, detail) => statuses.push({ status, detail }),
    registered,
    statuses,
    cache,
    ...overrides,
  };
  // Keep live references: after writeCache mutates cache, readCache must see it.
  const origWrite = deps.writeCache;
  deps.writeCache = async (c) => {
    cache = c;
    deps.cache = c;
    await origWrite(c);
  };
  deps.readCache = overrides.readCache ?? (async () => cache);
  return deps;
}

test("start with fresh cache registers cached models without fetching", async () => {
  const cachedModels = makeModels(["cached-a"]);
  const deps = makeDeps();
  deps.cache = { fetchedAt: NOW - 60_000, models: cachedModels }; // fresh
  const fetches: string[] = [];
  deps.fetch = async () => {
    fetches.push("called");
    return makeModels(["network-a"]);
  };
  // Seed cache directly.
  await deps.writeCache({ fetchedAt: NOW - 60_000, models: cachedModels });

  const loader = createCloudLoader(deps);
  await loader.start();

  assert.equal(fetches.length, 0, "no fetch for fresh cache");
  assert.equal(deps.registered.length, 1);
  assert.deepEqual(
    deps.registered[0].map((m) => m.id),
    ["cached-a"],
  );
  const st = loader.state();
  assert.equal(st.status, "ready");
  assert.equal(st.status === "ready" && st.models.length, 1);
  assert.equal(deps.statuses.at(-1)?.status, "ready");
});

test("start with stale cache fetches and writes a new cache", async () => {
  const deps = makeDeps();
  await deps.writeCache({
    fetchedAt: NOW - 2 * 60 * 60 * 1000, // 2h old: stale
    models: makeModels(["old-a"]),
  });

  const loader = createCloudLoader(deps);
  await loader.start();

  assert.equal(deps.registered.length, 1);
  assert.deepEqual(
    deps.registered[0].map((m) => m.id),
    ["fetched-a", "fetched-b"],
  );
  assert.ok(deps.cache, "cache written");
  assert.deepEqual(
    deps.cache!.models.map((m) => m.id),
    ["fetched-a", "fetched-b"],
  );
});

test("start with empty cache and network failure throws and marks failed", async () => {
  const deps = makeDeps({ fetch: async () => { throw new Error("network down"); } });
  const loader = createCloudLoader(deps);
  await assert.rejects(() => loader.start(), /network down/);
  const st = loader.state();
  assert.equal(st.status, "failed");
  assert.equal(String(loader.lastError()), "Error: network down");
  assert.equal(deps.registered.length, 0);
  assert.equal(deps.statuses.at(-1)?.status, "failed");
});

test("start with stale cache and network failure registers stale models and fails", async () => {
  const deps = makeDeps({ fetch: async () => { throw new Error("503"); } });
  await deps.writeCache({ fetchedAt: 0, models: makeModels(["stale-a"]) });

  const loader = createCloudLoader(deps);
  await assert.rejects(() => loader.start(), /503/);
  const st = loader.state();
  assert.equal(st.status, "failed");
  assert.equal(st.status === "failed" && st.models.length, 1);
  assert.equal(deps.registered.length, 1);
  assert.deepEqual(deps.registered[0].map((m) => m.id), ["stale-a"]);
});

test("retry only acts after a failure and succeeds when fetch recovers", async () => {
  let fail = true;
  const deps = makeDeps({
    fetch: async () => {
      if (fail) throw new Error("first attempt fails");
      return makeModels(["recovered-a"]);
    },
  });
  const loader = createCloudLoader(deps);
  await assert.rejects(() => loader.start());

  fail = false;
  await loader.retry();
  const st = loader.state();
  assert.equal(st.status, "ready");
  assert.deepEqual(
    deps.registered.at(-1)!.map((m) => m.id),
    ["recovered-a"],
  );

  // retry after success is a no-op
  const registeredBefore = deps.registered.length;
  await loader.retry();
  assert.equal(deps.registered.length, registeredBefore);
});

test("refresh forces a fetch even with a fresh cache", async () => {
  const deps = makeDeps();
  await deps.writeCache({
    fetchedAt: NOW - 1_000, // fresh
    models: makeModels(["cached-a"]),
  });
  const fetches: string[] = [];
  deps.fetch = async () => {
    fetches.push("called");
    return makeModels(["fresh-network-a"]);
  };

  const loader = createCloudLoader(deps);
  await loader.refresh();

  assert.equal(fetches.length, 1, "refresh must fetch");
  assert.deepEqual(
    deps.registered.at(-1)!.map((m) => m.id),
    ["fresh-network-a"],
  );
  const st = loader.state();
  assert.equal(st.status, "ready");
});

test("start dedupes concurrent invocations (single in-flight load)", async () => {
  const deps = makeDeps();
  await deps.writeCache({
    fetchedAt: 0, // stale, forces fetch
    models: makeModels(["stale"]),
  });
  let fetchCount = 0;
  deps.fetch = async () => {
    fetchCount++;
    return makeModels([`model-${fetchCount}`]);
  };

  const loader = createCloudLoader(deps);
  await Promise.all([loader.start(), loader.start()]);
  assert.equal(fetchCount, 1, "only one fetch for concurrent starts");
  assert.equal(deps.registered.length, 1);
});

// ---------------------------------------------------------------------------
// registerModels (provider registration shape)
// ---------------------------------------------------------------------------

test("registerModels registers the provider with correct config shape", () => {
  const registrations: Array<{ name: string; config: unknown }> = [];
  const pi = {
    registerProvider: (name: string, config: unknown) => {
      registrations.push({ name, config });
    },
    on: () => () => {},
    registerCommand: () => {},
  } as unknown as Parameters<typeof registerModels>[0];

  const models = makeModels(["m1"]).map((m) => ({
    ...m,
    thinkingLevelMap: { low: "low", medium: null } as CloudModelDef["thinkingLevelMap"],
  }));
  registerModels(pi, models);

  assert.equal(registrations.length, 1);
  const { name, config } = registrations[0];
  assert.equal(name, "ollama-cloud");
  const cfg = config as Record<string, unknown>;
  assert.equal(cfg.baseUrl, "https://ollama.com/v1");
  assert.equal(cfg.apiKey, "$OLLAMA_API_KEY");
  assert.equal(cfg.api, "openai-completions");
  const registered = cfg.models as Array<Record<string, unknown>>;
  assert.equal(registered.length, 1);
  assert.equal(registered[0].id, "m1");
  assert.equal(registered[0].reasoning, true);
  assert.equal(registered[0].contextWindow, 131072);
  assert.equal(registered[0].maxTokens, 32768);
  assert.deepEqual(registered[0].thinkingLevelMap, { low: "low", medium: null });
  const cost = registered[0].cost as Record<string, number>;
  assert.deepEqual(cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
});
