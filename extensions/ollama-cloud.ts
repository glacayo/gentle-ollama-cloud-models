/**
 * Ollama Cloud provider extension for Pi.
 *
 * Registers an `ollama-cloud` provider that uses the official Ollama Cloud
 * OpenAI-compatible endpoint (https://ollama.com/v1) directly with
 * `Authorization: Bearer $OLLAMA_API_KEY`. No local Ollama daemon required.
 *
 * - On startup: uses a cached catalog (1h TTL); falls back to a fresh fetch.
 * - `/ollama-cloud-refresh`: force-refresh the catalog and re-register the
 *   provider immediately (no /reload needed).
 * - `/ollama-cloud-status`: show the current catalog state and any last error.
 *
 * Endpoints (public, no auth required for discovery):
 *   GET  https://ollama.com/v1/models  -> { data: [{id}], models: [...meta] }
 *   POST https://ollama.com/api/show   -> { capabilities, model_info }
 *
 * Chat: https://ollama.com/v1/chat/completions (OpenAI-compatible) with
 * Bearer auth. Docs: https://docs.ollama.com/cloud
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

import {
  fetchCatalog,
  PROVIDER,
  PROVIDER_NAME,
  CLOUD_BASE_URL,
  type CloudModelDef,
} from "../src/catalog.ts";
import { readCache, writeCache, cacheFilePath } from "../src/cache.ts";
import { SNAPSHOT as snapshotCache } from "../src/catalog-snapshot.ts";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const STARTUP_TIMEOUT_MS = 15_000;
const STATUS_KEY = "ollama-cloud";
const SHOW_CONCURRENCY = 6;

// ---------------------------------------------------------------------------
// Provider registration
// ---------------------------------------------------------------------------

export interface RegisterDeps {
  registerProvider: ExtensionAPI["registerProvider"];
}

/** Registers (or replaces) the `ollama-cloud` provider with the given models. */
export function registerModels(
  pi: ExtensionAPI,
  models: CloudModelDef[],
): void {
  pi.registerProvider(PROVIDER, {
    name: PROVIDER_NAME,
    baseUrl: `${CLOUD_BASE_URL}/v1`,
    apiKey: "$OLLAMA_API_KEY",
    api: "openai-completions",
    compat: {
      // Ollama's OpenAI-compatible server does not use the developer role.
      supportsDeveloperRole: false,
      // reasoning_effort is not part of Ollama's OpenAI compatibility layer;
      // thinking is controlled per-model via thinkingLevelMap/samplingParams.
      supportsReasoningEffort: false,
      supportsUsageInStreaming: true,
      requiresToolResultName: false,
    },
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      input: m.input,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      ...(m.thinkingLevelMap !== undefined
        ? { thinkingLevelMap: m.thinkingLevelMap }
        : {}),
    })),
  });
}

// ---------------------------------------------------------------------------
// Loader state machine (testable, dependency-injected)
// ---------------------------------------------------------------------------

export type CloudLoaderState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; models: CloudModelDef[] }
  | { status: "failed"; error: unknown; models: CloudModelDef[] };

export interface CloudLoaderDeps {
  readCache: () => Promise<{ fetchedAt: number; models: CloudModelDef[] } | null>;
  writeCache: (cache: { fetchedAt: number; models: CloudModelDef[] }) => Promise<void>;
  fetch: () => Promise<CloudModelDef[]>;
  register: (models: CloudModelDef[]) => void;
  now: () => number;
  /** Emit status transitions for the UI/statusline. */
  setStatus: (
    status: "loading" | "ready" | "failed",
    detail: string,
    ctx?: ExtensionContext,
  ) => void;
}

export interface CloudLoader {
  start: (ctx?: ExtensionContext) => Promise<void>;
  retry: (ctx?: ExtensionContext) => Promise<void>;
  refresh: (ctx?: ExtensionContext) => Promise<void>;
  state: () => CloudLoaderState;
  lastError(): unknown | null;
}

const CACHE_TTL = CACHE_TTL_MS;

export function createCloudLoader(deps: CloudLoaderDeps): CloudLoader {
  let current: CloudLoaderState = { status: "idle" };
  let lastError: unknown | null = null;
  let inFlight: Promise<void> | null = null;
  let refreshInFlight: Promise<void> | null = null;

  async function load(
    ctx: ExtensionContext | undefined,
    force: boolean,
  ): Promise<void> {
    deps.setStatus("loading", "Loading Ollama Cloud models…", ctx);
    let cache: Awaited<ReturnType<typeof deps.readCache>> = null;
    try {
      cache = await deps.readCache();
      const cacheFresh =
        !force &&
        cache !== null &&
        cache.models.length > 0 &&
        deps.now() - cache.fetchedAt < CACHE_TTL;

      if (cacheFresh && cache !== null) {
        deps.register(cache.models);
        current = { status: "ready", models: cache.models };
        deps.setStatus("ready", `Ollama Cloud: ${cache.models.length} models (cached)`, ctx);
        return;
      }

      const models = await deps.fetch();
      const effectiveModels = models.length > 0 ? models : cache?.models ?? [];
      if (effectiveModels.length === 0) {
        throw new Error("Ollama Cloud catalog is empty and no cache available");
      }
      deps.register(effectiveModels);
      current = { status: "ready", models: effectiveModels };
      deps.setStatus(
        "ready",
        `Ollama Cloud: ${effectiveModels.length} models${models.length > 0 ? "" : " (stale cache)"}`,
        ctx,
      );
      if (models.length > 0) {
        await deps
          .writeCache({ fetchedAt: deps.now(), models })
          .catch(() => undefined);
      }
    } catch (error) {
      lastError = error;
      const staleModels = cache?.models ?? [];
      if (staleModels.length > 0) {
        try {
          deps.register(staleModels);
        } catch {
          // Registration failure is reported via the status transition.
        }
      }
      current = { status: "failed", error, models: staleModels };
      deps.setStatus(
        "failed",
        `Ollama Cloud unavailable — /ollama-cloud-refresh to retry`,
        ctx,
      );
      throw error;
    }
  }

  function startForced(ctx: ExtensionContext | undefined): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = load(ctx, true).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  const start = (ctx?: ExtensionContext): Promise<void> => {
    if (refreshInFlight) return refreshInFlight;
    if (inFlight) return inFlight;
    inFlight = load(ctx, false).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const retry = (ctx?: ExtensionContext): Promise<void> =>
    current.status === "failed" ? start(ctx) : Promise.resolve();

  const refresh = (ctx?: ExtensionContext): Promise<void> => {
    if (refreshInFlight) return refreshInFlight;
    const existing = inFlight;
    const operation = (async () => {
      if (existing) await existing.catch(() => {});
      return startForced(ctx);
    })();
    refreshInFlight = operation.finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  };

  return {
    start,
    retry,
    refresh,
    state: () => current,
    lastError: () => lastError,
  };
}

// ---------------------------------------------------------------------------
// Pi extension wiring
// ---------------------------------------------------------------------------

function createDefaultLoader(pi: ExtensionAPI): CloudLoader {
  return createCloudLoader({
    readCache: () => readCache(cacheFilePath()),
    writeCache: (cache) => writeCache(cache, cacheFilePath()),
    fetch: () =>
      fetchCatalog({
        signal: AbortSignal.timeout(STARTUP_TIMEOUT_MS),
        concurrency: SHOW_CONCURRENCY,
      }),
    register: (models) => registerModels(pi, models),
    now: Date.now,
    setStatus: (status, detail, ctx) => {
      // In TUI mode show transient status; never block on UI.
      if (!ctx || typeof ctx.ui?.setStatus !== "function") {
        if (status === "failed") console.error(`[ollama-cloud] ${detail}`);
        return;
      }
      try {
        if (status === "loading") {
          ctx.ui.setStatus(STATUS_KEY, "Loading Ollama Cloud models…");
        } else if (status === "ready") {
          ctx.ui.setStatus(STATUS_KEY, undefined);
        } else {
          ctx.ui.setStatus(STATUS_KEY, detail);
        }
      } catch {
        // Status display is best-effort.
      }
    },
  });
}

/** The factory registers a catalog immediately so `--list-models` and instant
 * sessions see models right away; the live refresh then replaces it.
 * Priority: local cache (fresher for long-lived installs) > bundled snapshot. */
export default async function (pi: ExtensionAPI): Promise<void> {
  const loader = createDefaultLoader(pi);

  // Fast local I/O: Pi awaits this async factory before listing models.
  let initial: CloudModelDef[] = snapshotCache.models;
  try {
    const cached = await readCache(cacheFilePath());
    if (cached && cached.models.length > 0) initial = cached.models;
  } catch {
    // fall back to the bundled snapshot
  }
  try {
    registerModels(pi, initial);
  } catch {
    // Registration failures surface through the loader's status handling.
  }

  pi.on("session_start", (_event, ctx) => {
    void loader.start(ctx).catch(() => {});
  });

  pi.registerCommand("ollama-cloud-refresh", {
    description: "Force-refresh the Ollama Cloud model catalog from ollama.com",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      try {
        await loader.refresh(ctx);
        const st = loader.state();
        const count = st.status === "ready" ? st.models.length : 0;
        ctx.ui.notify(`Ollama Cloud refreshed (${count} models)`, "info");
      } catch (error) {
        ctx.ui.notify(`Failed to refresh Ollama Cloud: ${String(error)}`, "error");
      }
    },
  });

  pi.registerCommand("ollama-cloud-status", {
    description: "Show the current Ollama Cloud catalog state",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const st = loader.state();
      if (st.status === "ready") {
        ctx.ui.notify(
          `Ollama Cloud ready: ${st.models.length} models registered (${st.models
            .slice(0, 5)
            .map((m) => m.id)
            .join(", ")}${st.models.length > 5 ? ", …" : ""})`,
          "info",
        );
      } else if (st.status === "failed") {
        ctx.ui.notify(
          `Ollama Cloud load failed: ${String(st.error)} — /ollama-cloud-refresh to retry`,
          "error",
        );
      } else {
        ctx.ui.notify(`Ollama Cloud status: ${st.status}`, "info");
      }
    },
  });

  pi.registerCommand("ollama-cloud-retry", {
    description: "Retry a failed Ollama Cloud catalog load",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (loader.state().status !== "failed") {
        ctx.ui.notify("Ollama Cloud does not need a retry", "info");
        return;
      }
      try {
        await loader.retry(ctx);
        ctx.ui.notify("Ollama Cloud models loaded", "info");
      } catch (error) {
        ctx.ui.notify(`Ollama Cloud retry failed: ${String(error)}`, "error");
      }
    },
  });
}
