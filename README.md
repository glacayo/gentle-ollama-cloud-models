# gentle-ollama-cloud-models

A [Pi](https://pi.dev) / [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) package that registers **Ollama Cloud** as a first-class model provider.

It discovers cloud models directly from [Ollama's public catalog](https://ollama.com/search?c=cloud) and routes chat through the official OpenAI-compatible endpoint at `https://ollama.com/v1` using your `OLLAMA_API_KEY`. No local Ollama daemon is required.

## Install

```bash
pi install npm:gentle-ollama-cloud-models
# or, in Gentle Shell
gentle-shell install npm:gentle-ollama-cloud-models
```

Set your Ollama Cloud API key:

```bash
export OLLAMA_API_KEY="your_api_key"
```

## What it does

- Registers an `ollama-cloud` provider using the official `https://ollama.com/v1` endpoint.
- Fetches the live model list from `https://ollama.com/v1/models` and enriches each model with capabilities and the real context window from `https://ollama.com/api/show`.
- Exposes each model's supported reasoning levels (low / medium / high / xhigh / max) when the model reports them.
- Caches the catalog for one hour and falls back to the stale cache when the network is unavailable.
- Adds `/ollama-cloud-refresh` to force a refresh and `/ollama-cloud-status` to inspect the current state.

## License

MIT
