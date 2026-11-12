# gentle-ollama-cloud-models

Pi/Gentle-Shell package that registers Ollama Cloud as a native provider, discovers models from the public Ollama Cloud catalog, and routes chat directly through `https://ollama.com/v1` using the OpenAI-compatible API.

## Specs

S1. The package must be installable with `pi install npm:gentle-ollama-cloud-models` and load via the `pi` package manifest (`pi.extensions`).
S2. The package must register a provider named `ollama-cloud` that uses `https://ollama.com/v1` as `baseUrl`, the `openai-completions` API, and authenticates with `$OLLAMA_API_KEY` as a Bearer token.
S3. On startup, the extension must fetch the public model catalog from `https://ollama.com/v1/models` and enrich each model with `POST https://ollama.com/api/show` to obtain capabilities and the real context window.
S4. Each registered model must expose the correct `contextWindow`, `maxTokens`, `input` modalities, `reasoning` flag, and a `thinkingLevelMap` built from the model's `supported_reasoning_levels` when present.
S5. The extension must expose `/ollama-cloud-refresh` to force a catalog refresh and re-registration, plus `/ollama-cloud-status` to report the current catalog state and any last error.
S6. The package must cache the fetched catalog locally (1-hour TTL) and fall back to the stale cache when the network is unavailable.
S7. The package must include the same CI and provenance-publish workflow as `tps-gentle-pi`: CI runs tests + package verification on every PR/push to `main`, and `publish.yml` publishes to npm with provenance when dispatched with an annotated version tag.
S8. The published package must include the `pi-package` keyword and an npm README so it appears on https://pi.dev/packages.

## Tasks

T1. Create the GitHub repository `glacayo/gentle-ollama-cloud-models` and local scaffold. Commit 8a57d47. → S1, S7
T2. Implement the provider extension: model discovery, capability enrichment, provider registration, cache, refresh/status commands. Commit 8b599eb. → S2, S3, S4, S5, S6
T3. Write unit tests for model normalization, capability enrichment, cache behavior, and provider registration with mocked fetch. Commit 8b599eb (18 tests, all green). → S7
T4. Copy and adapt the `tps-gentle-pi` CI/publish workflows, add verify-package script. Commit 8b599eb; CI run 43285344641 green. → S7
T5. Publish v0.1.0 to npm, verify the package appears on https://pi.dev/packages. → S8
T6. Smoke-test the extension in real Pi: `pi -e ./extensions/ollama-cloud.ts --list-models` shows `ollama-cloud` with 33 models, real context windows. Verified 2026-11-12. → S2, S3, S4

## Log

L1. "Necesito que creemos un packacge para PI y Gentle-Shell, Mejor que este package : https://github.com/riogesulgon/pi-ollama-cloud-models obviamente usando toda la documentacion disponible sobre Ollama Cloud y el uso de su api de su propia documentacion, asi como su registro en los providers de pi, actualizacion de modelos, datos correctos de contexto de cada modelo y effords disponibles https://docs.ollama.com/cloud . puedes crearlo como un repositorio publico en github con mi cuenta glacayo y tambien necesito que aparzca en la biblioteca de package en pi y npm https://pi.dev/packages . actualmente tengo un package publicado que aparece en pi y se despliega en npm automaticamente podemos adoptar ese workflow https://github.com/glacayo/tps-gentle-pi"
L2. Evidence 2026-11-12: live catalog probe fetched 22 chat models (plus more appearing over time); real context windows from /v1/models (beam 1048576, gemma4:31b 262144, minimax-m3 512000, gpt-oss 131072); per-model efforts from supported_reasoning_levels (beam low..max, glm-5.3 low/high/max). /api/show gives capabilities (thinking, vision, tools). clef:27b excluded (supported_in_api false). Decision: catalog metadata wins over /api/show for contextWindow (cloud serving limit vs model-card default).
L3. Findings 2026-11-12 (clean-home verification, commit 125a8b5): (a) Pi composes models.json ABOVE extension-registered providers — the user's pre-existing ollama-cloud models.json entry in ~/.gentle-shell/agent supplied the stored API key while our registration supplied baseUrl and models, which polluted the first smoke test. (b) Pi's --list-models filters models of providers without resolvable credentials: with OLLAMA_API_KEY unset and no auth.json entry, the clean home shows "No models available"; with the key set, all 22 models list and real chat answers through the direct cloud API (verified). (c) Fire-and-forget session_start registration left the catalog empty at startup; fixed by an async factory that registers cache-or-bundled-snapshot (Pi awaits async factories before listing). (d) The user's existing manual models.json entry (stale list, thinkingLevelMap mostly null) should be removed once the package is installed in that home; the auth.json ollama-cloud key stays and authenticates by provider name.
