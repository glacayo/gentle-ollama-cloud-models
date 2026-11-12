/**
 * Bundled Ollama Cloud catalog snapshot.
 *
 * Generated from the live https://ollama.com/v1/models catalog so the
 * provider has models immediately at startup (before the live refresh).
 * Regenerate with: npm run snapshot
 */

import type { CatalogCacheShape } from "./catalog.ts";

export const SNAPSHOT: CatalogCacheShape = {
  "fetchedAt": 1794513052211,
  "models": [
    {
      "id": "beam",
      "slug": "beam",
      "name": "beam",
      "reasoning": true,
      "input": [
        "text"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "max"
      },
      "defaultEffort": "max"
    },
    {
      "id": "deepseek-v4-pro:0813",
      "slug": "deepseek-v4-pro:0813",
      "name": "deepseek-v4-pro:0813",
      "reasoning": true,
      "input": [
        "text"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "tools",
        "thinking"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": null,
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "low"
    },
    {
      "id": "deepseek-v4.1-flash",
      "slug": "deepseek-v4.1-flash",
      "name": "deepseek-v4.1-flash",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools",
        "vision"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": null,
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "high"
    },
    {
      "id": "deepseek-v4.1-flash:1017",
      "slug": "deepseek-v4.1-flash:1017",
      "name": "deepseek-v4.1-flash:1017",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools",
        "vision"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": null,
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "high"
    },
    {
      "id": "gemma4:31b",
      "slug": "gemma4:31b",
      "name": "gemma4:31b",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 262144,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools",
        "vision"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": null,
        "medium": "medium",
        "high": null,
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "none"
    },
    {
      "id": "glm-5.2",
      "slug": "glm-5.2",
      "name": "glm-5.2",
      "reasoning": true,
      "input": [
        "text"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "thinking",
        "completion",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": null,
        "medium": null,
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "high"
    },
    {
      "id": "glm-5.3",
      "slug": "glm-5.3",
      "name": "glm-5.3",
      "reasoning": true,
      "input": [
        "text"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": null,
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "max"
    },
    {
      "id": "glm-5.3-flash",
      "slug": "glm-5.3-flash",
      "name": "glm-5.3-flash",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools",
        "vision"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": null,
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "max"
    },
    {
      "id": "gpt-oss:120b",
      "slug": "gpt-oss:120b",
      "name": "gpt-oss:120b",
      "reasoning": true,
      "input": [
        "text"
      ],
      "contextWindow": 131072,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "tools",
        "thinking"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "medium"
    },
    {
      "id": "gpt-oss:20b",
      "slug": "gpt-oss:20b",
      "name": "gpt-oss:20b",
      "reasoning": true,
      "input": [
        "text"
      ],
      "contextWindow": 131072,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "tools",
        "thinking"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "medium"
    },
    {
      "id": "kimi-k2.6",
      "slug": "kimi-k2.6",
      "name": "kimi-k2.6",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 262144,
      "maxTokens": 10000,
      "capabilities": [
        "vision",
        "thinking",
        "completion",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": null,
        "medium": "medium",
        "high": null,
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "medium"
    },
    {
      "id": "kimi-k2.7-code",
      "slug": "kimi-k2.7-code",
      "name": "kimi-k2.7-code",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 262144,
      "maxTokens": 10000,
      "capabilities": [
        "vision",
        "thinking",
        "completion",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": null,
        "medium": "medium",
        "high": null,
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "medium"
    },
    {
      "id": "kimi-k3",
      "slug": "kimi-k3",
      "name": "kimi-k3",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "vision",
        "thinking",
        "completion",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": null,
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "max"
    },
    {
      "id": "kimi-k3.1-pro",
      "slug": "kimi-k3.1-pro",
      "name": "kimi-k3.1-pro",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "vision",
        "thinking",
        "completion",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "max"
    },
    {
      "id": "mimo-v2.6-flash",
      "slug": "mimo-v2.6-flash",
      "name": "mimo-v2.6-flash",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools",
        "vision"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": null,
        "medium": "medium",
        "high": null,
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "medium"
    },
    {
      "id": "mimo-v2.6-pro",
      "slug": "mimo-v2.6-pro",
      "name": "mimo-v2.6-pro",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools",
        "vision"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": null,
        "medium": "medium",
        "high": null,
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "medium"
    },
    {
      "id": "minimax-m3",
      "slug": "minimax-m3",
      "name": "minimax-m3",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 512000,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "tools",
        "thinking",
        "vision"
      ]
    },
    {
      "id": "minimax-m3.1-flash",
      "slug": "minimax-m3.1-flash",
      "name": "minimax-m3.1-flash",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1000000,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "tools",
        "thinking",
        "vision"
      ]
    },
    {
      "id": "mistral-large-4",
      "slug": "mistral-large-4",
      "name": "mistral-large-4",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools",
        "vision"
      ]
    },
    {
      "id": "muse-spark-open",
      "slug": "muse-spark-open",
      "name": "muse-spark-open",
      "reasoning": true,
      "input": [
        "text",
        "image"
      ],
      "contextWindow": 1048576,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools",
        "vision"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": null,
        "max": "max"
      },
      "defaultEffort": "high"
    },
    {
      "id": "nemotron-3-super",
      "slug": "nemotron-3-super",
      "name": "nemotron-3-super",
      "reasoning": true,
      "input": [
        "text"
      ],
      "contextWindow": 262144,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": null,
        "medium": "medium",
        "high": null,
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "medium"
    },
    {
      "id": "nemotron-3-ultra",
      "slug": "nemotron-3-ultra",
      "name": "nemotron-3-ultra",
      "reasoning": true,
      "input": [
        "text"
      ],
      "contextWindow": 262144,
      "maxTokens": 10000,
      "capabilities": [
        "completion",
        "thinking",
        "tools"
      ],
      "thinkingLevelMap": {
        "minimal": null,
        "low": null,
        "medium": "medium",
        "high": null,
        "xhigh": null,
        "max": null
      },
      "defaultEffort": "medium"
    }
  ]
} as CatalogCacheShape;
