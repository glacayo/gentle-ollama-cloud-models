# gentle-ollama-cloud-models

A [Pi](https://pi.dev) / [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) package that registers **Ollama Cloud** as a first-class model provider.

It discovers cloud models directly from [Ollama's public catalog](https://ollama.com/search?c=cloud) — real context windows, reasoning efforts, and input modalities — and routes chat through the official OpenAI-compatible endpoint at `https://ollama.com/v1` using your `OLLAMA_API_KEY`. **No local Ollama daemon is required.**

```text
ollama-cloud/glm-5.3  ·  1,048,576 ctx  ·  efforts: low/high/max
```

## Install

```bash
pi install npm:gentle-ollama-cloud-models
```

Or in Gentle Shell:

```bash
gentle-shell install npm:gentle-ollama-cloud-models
```

Try it without installing:

```bash
pi -e npm:gentle-ollama-cloud-models
```

Set your [Ollama Cloud API key](https://ollama.com/settings/keys) as an environment variable:

```bash
export OLLAMA_API_KEY="your_api_key"
```

Then pick a model with `/model` → `ollama-cloud/...`.

## What it does

- Registers an `ollama-cloud` provider using the official `https://ollama.com/v1` OpenAI-compatible endpoint ([docs](https://docs.ollama.com/cloud)).
- Fetches the live model list from `https://ollama.com/v1/models` and enriches each model with capabilities (`thinking`, `vision`, `tools`) from `https://ollama.com/api/show`.
- Uses each model's **real context window** (the cloud serving limit, e.g. 1,048,576 for `glm-5.3`, 262,144 for `gemma4:31b`), not a hardcoded default.
- Exposes each model's **supported reasoning efforts** (`low` / `medium` / `high` / `xhigh` / `max`) as a `thinkingLevelMap`, so Pi's thinking-level selector only offers levels the model actually supports.
- Skips models the API does not support (`supported_in_api: false`, e.g. System One models).
- Caches the catalog for one hour and falls back to the stale cache when the network is unavailable.
- Adds `/ollama-cloud-refresh` (force-refresh), `/ollama-cloud-status` (catalog state), and `/ollama-cloud-retry` (retry after failure).

## Commands

| Command | Description |
| --- | --- |
| `/ollama-cloud-refresh` | Force-refresh the catalog from ollama.com and re-register the provider immediately. |
| `/ollama-cloud-status` | Show how many models are registered and which ids. |
| `/ollama-cloud-retry` | Retry a failed catalog load. |

## Model metadata

| Field | Source |
| --- | --- |
| `id` | `data[].id` from `https://ollama.com/v1/models` (e.g. `glm-5.3`) |
| `contextWindow` | `max_context_window` / `context_window` from the catalog, falling back to `<arch>.context_length` from `/api/show` |
| `reasoning` | `thinking` capability from `/api/show` |
| `thinkingLevelMap` | `supported_reasoning_levels` (efforts) from the catalog |
| `input` | `vision` capability from `/api/show`, or `input_modalities` from the catalog |
| `maxTokens` | 32,768 (safe default; Ollama Cloud does not publish per-model output limits) |

## Development

```bash
npm test              # unit tests (node --test, no dependencies)
npm run verify:package  # verify the npm tarball contents
```

Zero-build TypeScript: the suite runs the sources directly on Node 24+ via native type stripping.

## License

MIT
