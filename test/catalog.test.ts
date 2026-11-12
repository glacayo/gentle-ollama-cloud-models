/**
 * Unit tests for Ollama Cloud catalog fetching and model normalization.
 * Uses only node:test and mocks fetch via injectable deps.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fetchCatalog,
  thinkingLevelMapFromMeta,
  type CloudModelDef,
} from "../src/catalog.ts";

// ---------------------------------------------------------------------------
// thinkingLevelMapFromMeta
// ---------------------------------------------------------------------------

test("thinkingLevelMapFromMeta maps supported efforts and nulls the rest", () => {
  const meta = {
    supported_reasoning_levels: [
      { effort: "low", description: "low reasoning effort" },
      { effort: "medium", description: "medium reasoning effort" },
      { effort: "high", description: "high reasoning effort" },
      { effort: "xhigh", description: "xhigh reasoning effort" },
      { effort: "max", description: "max reasoning effort" },
    ],
    default_reasoning_level: "medium",
  };
  const { map, defaultEffort } = thinkingLevelMapFromMeta(meta);
  assert.equal(defaultEffort, "medium");
  assert.ok(map);
  assert.equal(map!.low, "low");
  assert.equal(map!.medium, "medium");
  assert.equal(map!.high, "high");
  assert.equal(map!.xhigh, "xhigh");
  assert.equal(map!.max, "max");
  // Unsupported pi levels are explicitly nulled so Pi can gray them out.
  assert.equal(map!.minimal, null);
});

test("thinkingLevelMapFromMeta returns undefined map for empty levels", () => {
  const { map, defaultEffort } = thinkingLevelMapFromMeta({
    supported_reasoning_levels: [],
  });
  assert.equal(map, undefined);
  assert.equal(defaultEffort, undefined);
});

test("thinkingLevelMapFromMeta tolerates non-object meta", () => {
  const { map } = thinkingLevelMapFromMeta(null);
  assert.equal(map, undefined);
  const { map: m2 } = thinkingLevelMapFromMeta("nope");
  assert.equal(m2, undefined);
});

// ---------------------------------------------------------------------------
// fetchCatalog with mocked fetch
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeMockFetch(
  modelsPayload: unknown,
  showPayload: Record<string, unknown>,
  calls: FetchCall[],
): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const href = typeof url === "string" ? url : url.toString();
    calls.push({ url: href, init });
    if (href === "https://ollama.com/v1/models") {
      return jsonResponse(modelsPayload);
    }
    if (href === "https://ollama.com/api/show") {
      return jsonResponse(showPayload);
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

const MODELS_PAYLOAD = {
  object: "list",
  data: [{ id: "gemma4:31b" }, { id: "glm-5.3" }],
  models: [
    {
      slug: "gemma4:31b",
      display_name: "Gemma4 31B",
      context_window: 262144,
      max_context_window: 262144,
      supported_reasoning_levels: [],
      input_modalities: ["text", "image"],
      supported_in_api: true,
    },
    {
      slug: "glm-5.3",
      display_name: "GLM-5.3",
      context_window: 1048576,
      max_context_window: 1048576,
      supported_reasoning_levels: [
        { effort: "low" },
        { effort: "medium" },
        { effort: "high" },
      ],
      default_reasoning_level: "medium",
      input_modalities: ["text"],
      supported_in_api: true,
    },
  ],
};

const SHOW_PAYLOAD = {
  capabilities: ["completion", "thinking", "tools", "vision"],
  model_info: {
    "gemma4.context_length": 262144,
    "gemma4.embedding_length": 5376,
    "general.architecture": "gemma4",
  },
};

test("fetchCatalog fetches /v1/models and enriches with /api/show", async () => {
  const calls: FetchCall[] = [];
  const fetchImpl = makeMockFetch(MODELS_PAYLOAD, SHOW_PAYLOAD, calls);
  const models = await fetchCatalog({ fetch: fetchImpl, concurrency: 1 });

  // Two /api/show calls, one per model.
  const showCalls = calls.filter((c) => c.url === "https://ollama.com/api/show");
  assert.equal(showCalls.length, 2);

  const gemma = models.find((m) => m.id === "gemma4:31b");
  assert.ok(gemma, "gemma4:31b present");
  assert.equal(gemma!.name, "Gemma4 31B");
  assert.equal(gemma!.reasoning, true); // capabilities include "thinking"
  assert.deepEqual(gemma!.input, ["text", "image"]); // vision capability
  assert.equal(gemma!.contextWindow, 262144); // from /api/show model_info
  assert.equal(gemma!.maxTokens, 32768);

  const glm = models.find((m) => m.id === "glm-5.3");
  assert.ok(glm, "glm-5.3 present");
  assert.equal(glm!.contextWindow, 1048576); // catalog metadata (show had none for glm)
  assert.equal(glm!.reasoning, true); // thinkingLevelMap has non-null values
  assert.ok(glm!.thinkingLevelMap);
  assert.equal(glm!.thinkingLevelMap!.low, "low");
  assert.equal(glm!.thinkingLevelMap!.medium, "medium");
  assert.equal(glm!.thinkingLevelMap!.high, "high");
  assert.equal(glm!.thinkingLevelMap!.xhigh, null);
  assert.equal(glm!.thinkingLevelMap!.max, null);
  assert.equal(glm!.defaultEffort, "medium");
});

test("fetchCatalog sorts output by id", async () => {
  const calls: FetchCall[] = [];
  const fetchImpl = makeMockFetch(MODELS_PAYLOAD, SHOW_PAYLOAD, calls);
  const models = await fetchCatalog({ fetch: fetchImpl, concurrency: 1 });
  assert.ok(models.length >= 2);
  for (let i = 1; i < models.length; i++) {
    assert.ok(
      models[i - 1].id.localeCompare(models[i].id) <= 0,
      `sorted: ${models[i - 1].id} <= ${models[i].id}`,
    );
  }
});

test("fetchCatalog skips models with supported_in_api false", async () => {
  const payload = {
    object: "list",
    data: [{ id: "hidden-model" }, { id: "real-model" }],
    models: [
      { slug: "hidden-model", supported_in_api: false, context_window: 65536 },
      { slug: "real-model", supported_in_api: true, context_window: 131072 },
    ],
  };
  const calls: FetchCall[] = [];
  const fetchImpl = makeMockFetch(payload, { capabilities: [] }, calls);
  const models = await fetchCatalog({ fetch: fetchImpl, concurrency: 1 });
  const ids = models.map((m) => m.id);
  assert.ok(!ids.includes("hidden-model"));
  assert.ok(ids.includes("real-model"));
});

test("fetchCatalog falls back to 131072 context when no source reports one", async () => {
  const payload = {
    object: "list",
    data: [{ id: "unknown-model" }],
    models: [],
  };
  const calls: FetchCall[] = [];
  const fetchImpl = makeMockFetch(
    payload,
    { capabilities: [], model_info: {} },
    calls,
  );
  const models = await fetchCatalog({ fetch: fetchImpl, concurrency: 1 });
  assert.equal(models.length, 1);
  assert.equal(models[0].contextWindow, 131072);
  assert.equal(models[0].reasoning, false);
  assert.deepEqual(models[0].input, ["text"]);
});

test("fetchCatalog tolerates /api/show failures (retired models)", async () => {
  const payload = {
    object: "list",
    data: [{ id: "retired" }, { id: "live" }],
    models: [
      { slug: "retired", context_window: 100000 },
      { slug: "live", context_window: 200000 },
    ],
  };
  const fetchImpl: typeof fetch = (async (url: string | URL | Request): Promise<Response> => {
    const href = typeof url === "string" ? url : url.toString();
    if (href === "https://ollama.com/v1/models") {
      return jsonResponse(payload);
    }
    if (href.endsWith("/api/show")) {
      const body = (arguments[1] as RequestInit)?.body as string;
      if (body.includes("retired")) {
        return new Response("gone", { status: 404 });
      }
      return jsonResponse({ capabilities: ["tools"], model_info: {} });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;

  const models = await fetchCatalog({ fetch: fetchImpl, concurrency: 1 });
  assert.equal(models.length, 2); // retired still uses catalog metadata
  const retired = models.find((m) => m.id === "retired");
  assert.equal(retired!.contextWindow, 100000);
  assert.equal(retired!.reasoning, false); // no /api/show info, no thinking levels
});

test("fetchCatalog throws on non-OK /v1/models response", async () => {
  const fetchImpl: typeof fetch = (async () =>
    new Response("boom", { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(
    () => fetchCatalog({ fetch: fetchImpl }),
    /HTTP 500/,
  );
});

test("fetchCatalog deduplicates ids in data", async () => {
  const payload = {
    object: "list",
    data: [{ id: "dup" }, { id: "dup" }, { id: "other" }],
    models: [{ slug: "dup", context_window: 5000 }],
  };
  const calls: FetchCall[] = [];
  const fetchImpl = makeMockFetch(payload, { capabilities: [] }, calls);
  const models = await fetchCatalog({ fetch: fetchImpl, concurrency: 1 });
  assert.equal(models.filter((m) => m.id === "dup").length, 1);
});
