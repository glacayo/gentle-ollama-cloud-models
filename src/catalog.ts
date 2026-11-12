/**
 * Ollama Cloud catalog fetching and model normalization.
 *
 * Talks to the public Ollama Cloud endpoints documented at
 * https://docs.ollama.com/cloud:
 *
 *   GET  https://ollama.com/v1/models  -> { data: [{ id }], models: [...meta] }
 *   POST https://ollama.com/api/show   -> { capabilities, model_info, thinking }
 *
 * Chat requests go to https://ollama.com/v1 (OpenAI-compatible) with
 * `Authorization: Bearer $OLLAMA_API_KEY`.
 */

export const CLOUD_BASE_URL = "https://ollama.com";
export const PROVIDER = "ollama-cloud";
export const PROVIDER_NAME = "Ollama Cloud";

export type CloudInput = "text" | "image";

/** Pi thinking levels are fixed: minimal | low | medium | high | xhigh | max */
export type PiThinkingLevel =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export interface CloudModelDef {
  /** Model id used against https://ollama.com/v1 (e.g. "gemma4:31b"). */
  id: string;
  /** Display name (e.g. "Gemma4 31B" or the raw slug). */
  name: string;
  /** Raw slug from the catalog (e.g. "gemma4:31b"). */
  slug: string;
  reasoning: boolean;
  input: CloudInput[];
  /** Real context window in tokens, from /v1/models or /api/show. */
  contextWindow: number;
  /** Maximum output tokens. */
  maxTokens: number;
  /** Capabilities from /api/show (e.g. "thinking", "vision", "tools"). */
  capabilities: string[];
  /** Map of pi thinking levels -> provider effort strings. */
  thinkingLevelMap?: Partial<Record<PiThinkingLevel, string | null>>;
  /** Default provider reasoning effort for this model, when reported. */
  defaultEffort?: string;
}

export interface CatalogCacheShape {
  fetchedAt: number;
  models: CloudModelDef[];
}

/** Fetch helper with timeout support. */
export async function fetchJson(
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<unknown> {
  const res = await fetchImpl(url, init);
  if (!res.ok) {
    throw new Error(`${url} -> HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Extracts the real context window from the catalog entry. The `/v1/models`
 * endpoint returns two arrays: `data` (OpenAI-style, just ids) and `models`
 * (Ollama-specific, with `context_window` and `max_context_window`).
 */
function contextWindowFromMeta(meta: unknown): number | undefined {
  if (typeof meta !== "object" || meta === null) return undefined;
  const m = meta as Record<string, unknown>;
  if (typeof m.max_context_window === "number" && m.max_context_window > 0) {
    return m.max_context_window;
  }
  if (typeof m.context_window === "number" && m.context_window > 0) {
    return m.context_window;
  }
  return undefined;
}

/** The set of pi thinking levels we recognize from provider effort strings. */
const PI_LEVELS: readonly PiThinkingLevel[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

/**
 * Builds a `thinkingLevelMap` from the provider's `supported_reasoning_levels`
 * (an array like `[{effort: "low", ...}, {effort: "max", ...}]`). Only pi levels
 * the model actually supports are included; unsupported pi levels map to `null`
 * so Pi can gray them out. When the model has a `default_reasoning_level`, all
 * supported pi levels other than the mapped default stay provider-native.
 */
export function thinkingLevelMapFromMeta(
  meta: unknown,
): { map: CloudModelDef["thinkingLevelMap"]; defaultEffort?: string } {
  const result: { map: CloudModelDef["thinkingLevelMap"]; defaultEffort?: string } = {
    map: undefined,
  };
  if (typeof meta !== "object" || meta === null) return result;
  const m = meta as Record<string, unknown>;

  const levels: unknown = m.supported_reasoning_levels;
  if (!Array.isArray(levels) || levels.length === 0) return result;

  const efforts = levels
    .map((l) =>
      typeof l === "object" && l !== null
        ? (l as Record<string, unknown>).effort
        : undefined,
    )
    .filter((e): e is string => typeof e === "string" && e.length > 0);

  if (efforts.length === 0) return result;

  const map: Partial<Record<PiThinkingLevel, string | null>> = {};
  for (const piLevel of PI_LEVELS) {
    const matched = efforts.find(
      (e) => e.toLowerCase() === piLevel,
    );
    if (matched) {
      map[piLevel] = matched;
    } else {
      // Mark as unsupported so Pi does not offer it as a valid level.
      map[piLevel] = null;
    }
  }

  const defaultLevel = m.default_reasoning_level;
  result.map = map;
  if (typeof defaultLevel === "string" && defaultLevel.length > 0) {
    result.defaultEffort = defaultLevel;
  }
  return result;
}

/** Input modalities from the catalog entry. */
function inputFromMeta(
  meta: unknown,
  capabilities: string[],
): CloudInput[] {
  const inputs: CloudInput[] = ["text"];
  if (capabilities.includes("vision")) {
    inputs.push("image");
    return inputs;
  }
  if (typeof meta === "object" && meta !== null) {
    const m = meta as Record<string, unknown>;
    if (
      Array.isArray(m.input_modalities) &&
      m.input_modalities.includes("image")
    ) {
      inputs.push("image");
    }
  }
  return inputs;
}

/** Context window from /api/show model_info (`<arch>.context_length`). */
function contextWindowFromShow(show: unknown): number | undefined {
  if (typeof show !== "object" || show === null) return undefined;
  const s = show as Record<string, unknown>;
  const modelInfo = s.model_info;
  if (typeof modelInfo !== "object" || modelInfo === null) return undefined;
  let best = 0;
  for (const [k, v] of Object.entries(modelInfo as Record<string, unknown>)) {
    if (k.endsWith(".context_length") && typeof v === "number") {
      best = Math.max(best, v);
    }
  }
  return best > 0 ? best : undefined;
}

/** Capabilities from /api/show. */
function capabilitiesFromShow(show: unknown): string[] {
  if (typeof show !== "object" || show === null) return [];
  const s = show as Record<string, unknown>;
  return Array.isArray(s.capabilities)
    ? s.capabilities.filter((c): c is string => typeof c === "string")
    : [];
}

/**
 * Fetches capabilities + context length for one model via `/api/show`.
 * Returns null when the model is retired or transiently unavailable.
 * The catalog `id` (e.g. "gemma4:31b") works directly against /api/show.
 */
export async function showModel(
  id: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<{ capabilities: string[]; contextWindow: number | undefined } | null> {
  try {
    const res = await fetchImpl(`${CLOUD_BASE_URL}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: id }),
      signal,
    });
    if (!res.ok) return null;
    const show: unknown = await res.json();
    return {
      capabilities: capabilitiesFromShow(show),
      contextWindow: contextWindowFromShow(show),
    };
  } catch {
    // Retired models and transient errors: skip silently.
    return null;
  }
}

export interface FetchCatalogDeps {
  fetch?: typeof fetch;
  /** Abort signal honored for the whole catalog fetch. */
  signal?: AbortSignal;
  /** Max concurrent /api/show enrichments. */
  concurrency?: number;
  /** Per-model timeout for /api/show enrichment. */
  showTimeoutMs?: number;
}

/**
 * Fetches the full Ollama Cloud catalog with per-model capability enrichment.
 *
 * The `/v1/models` response includes both:
 * - `data`: OpenAI-style array of `{ id }`.
 * - `models`: Ollama-specific array with `slug`, `context_window`,
 *   `supported_reasoning_levels`, `input_modalities`, `visibility`, etc.
 *
 * Models whose `visibility` is not `"list"` are still included when present in
 * `data` (the API contract), but `supported_in_api: false` entries are skipped
 * because direct API requests cannot reach them.
 */
export async function fetchCatalog(
  deps: FetchCatalogDeps = {},
): Promise<CloudModelDef[]> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const concurrency = deps.concurrency ?? 6;
  const showTimeoutMs = deps.showTimeoutMs ?? 15_000;

  const payload: unknown = await fetchJson(`${CLOUD_BASE_URL}/v1/models`, {
    signal: deps.signal,
  }, fetchImpl);

  if (typeof payload !== "object" || payload === null) {
    throw new Error("unexpected /v1/models payload");
  }
  const p = payload as Record<string, unknown>;
  const data = Array.isArray(p.data) ? p.data : [];
  const metaList = Array.isArray(p.models) ? p.models : [];
  const metaBySlug = new Map<string, unknown>();
  for (const meta of metaList) {
    if (typeof meta === "object" && meta !== null) {
      const slug = (meta as Record<string, unknown>).slug;
      if (typeof slug === "string") metaBySlug.set(slug, meta);
    }
  }

  // Deduplicate ids.
  const ids: string[] = [];
  for (const entry of data) {
    const id = (entry as Record<string, unknown>)?.id;
    if (typeof id === "string" && id.length > 0 && !ids.includes(id)) {
      ids.push(id);
    }
  }

  // Enrich with /api/show in a bounded worker pool.
  const enriched: { id: string; capabilities: string[]; contextWindow: number | undefined }[] =
    [];
  const queue = [...ids];
  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
    while (queue.length > 0) {
      const id = queue.shift()!;
      const signal = deps.signal ?? AbortSignal.timeout(showTimeoutMs);
      const info = await showModel(id, fetchImpl, signal);
      enriched.push({
        id,
        capabilities: info?.capabilities ?? [],
        contextWindow: info?.contextWindow,
      });
    }
  });
  await Promise.all(workers);

  // Build model definitions.
  const defs: CloudModelDef[] = [];
  for (const { id, capabilities, contextWindow } of enriched) {
    const meta = metaBySlug.get(id);
    // Catalog metadata (the cloud serving limit) wins; /api/show's
    // model_info.context_length (model-card default) is the fallback.
    const ctxWindow = contextWindowFromMeta(meta) ?? contextWindow ?? 131072;

    // Skip models the API explicitly does not support (e.g. visibility=hide).
    if (
      typeof meta === "object" &&
      meta !== null &&
      (meta as Record<string, unknown>).supported_in_api === false
    ) {
      continue;
    }

    const { map: thinkingLevelMap, defaultEffort } = thinkingLevelMapFromMeta(meta);
    const reasoning = capabilities.includes("thinking") || (thinkingLevelMap !== undefined && Object.values(thinkingLevelMap).some((v) => v !== null));

    defs.push({
      id,
      slug: id,
      name: displayName(id, meta),
      reasoning,
      input: inputFromMeta(meta, capabilities),
      contextWindow: ctxWindow,
      maxTokens: maxTokensFromMeta(meta) ?? 32768,
      capabilities,
      thinkingLevelMap,
      defaultEffort,
    });
  }

  // Sort by id for stable output.
  defs.sort((a, b) => a.id.localeCompare(b.id));
  return defs;
}

/** Human-friendly display name derived from the slug. */
function displayName(slug: string, meta: unknown): string {
  if (typeof meta === "object" && meta !== null) {
    const dn = (meta as Record<string, unknown>).display_name;
    if (typeof dn === "string" && dn.length > 0) return dn;
  }
  return slug
    .replace(/[:\-_]+/g, " ")
    .replace(/\b(\w)/g, (c) => c.toUpperCase());
}

/** Maximum output tokens from catalog metadata, when present. */
function maxTokensFromMeta(meta: unknown): number | undefined {
  if (typeof meta !== "object" || meta === null) return undefined;
  const m = meta as Record<string, unknown>;
  // Ollama Cloud does not consistently report max output tokens; use
  // truncation_policy.limit when present as a best-effort signal.
  const tp = m.truncation_policy;
  if (typeof tp === "object" && tp !== null) {
    const limit = (tp as Record<string, unknown>).limit;
    if (typeof limit === "number" && limit > 0 && limit < 32768) return limit;
  }
  return undefined;
}
