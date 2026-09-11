/**
 * Doubleword provider for the Vercel AI SDK.
 *
 * Thin wrapper over `@ai-sdk/openai-compatible` that configures the base URL,
 * API key resolution, and custom headers for Doubleword's OpenAI-compatible
 * inference gateway.
 */

import {
  createOpenAICompatible,
} from "@ai-sdk/openai-compatible";
import type {
  EmbeddingModelV3,
  LanguageModelV3,
} from "@ai-sdk/provider";
import { resolveApiKey, resolveBaseURL } from "./credentials.js";
import {
  applyCacheControl,
  normalizeCacheConfig,
  type CacheOption,
} from "./cache.js";
import { VERSION } from "./version.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoublewordProviderOptions {
  /**
   * Doubleword API key. If omitted, resolved from `DOUBLEWORD_API_KEY` env
   * var, then `~/.dw/credentials.toml`.
   */
  apiKey?: string;

  /**
   * Base URL for the Doubleword API.
   * @default "https://api.doubleword.ai/v1" or DOUBLEWORD_API_BASE env var
   */
  baseURL?: string;

  /**
   * Extra headers sent with every request.
   */
  headers?: Record<string, string>;

  /**
   * Enable Doubleword prompt caching. `true` caches the system prefix for
   * `1h`; pass `{ ttl, scope }` to tune it. Override or disable it per request
   * with `providerOptions: { doubleword: { cacheControl } }`.
   */
  cache?: CacheOption;
}

export interface DoublewordProvider {
  /**
   * Create a language model for the given model ID.
   *
   * @example
   * ```ts
   * const model = doubleword("gpt-4o");
   * ```
   */
  (modelId: string): LanguageModelV3;

  /**
   * Create a language model for the given model ID.
   */
  languageModel(modelId: string): LanguageModelV3;

  /**
   * Create a chat language model for the given model ID.
   * Alias for `languageModel`.
   */
  chatModel(modelId: string): LanguageModelV3;

  /**
   * Create an embedding model for the given model ID.
   *
   * @example
   * ```ts
   * const model = doubleword.embeddingModel("text-embedding-3-small");
   * ```
   */
  embeddingModel(modelId: string): EmbeddingModelV3;

  /**
   * Create a text embedding model for the given model ID.
   * Alias for `embeddingModel`.
   */
  textEmbeddingModel(modelId: string): EmbeddingModelV3;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Doubleword provider instance.
 *
 * @example
 * ```ts
 * import { createDoubleword } from "@doubleword/vercel-ai";
 *
 * const doubleword = createDoubleword({ apiKey: "sk-..." });
 * const model = doubleword("gpt-4o");
 * ```
 */
export function createDoubleword(
  options: DoublewordProviderOptions = {},
): DoublewordProvider {
  const baseURL = options.baseURL ?? resolveBaseURL();
  const apiKey = options.apiKey ?? resolveApiKey();
  const providerCache = normalizeCacheConfig(options.cache);

  const provider = createOpenAICompatible({
    name: "doubleword",
    baseURL,
    apiKey,
    headers: {
      "User-Agent": `@doubleword/vercel-ai/${VERSION}`,
      ...options.headers,
    },
    // Inject Doubleword `cache_control` on the outgoing body. A per-request
    // `providerOptions.doubleword.cacheControl` arrives here as a top-level
    // `cacheControl` field (unknown keys are spread by the base provider); it
    // overrides the provider default and is stripped before dispatch.
    transformRequestBody: (body) => {
      const override = (body as Record<string, unknown>)["cacheControl"];
      delete (body as Record<string, unknown>)["cacheControl"];
      const config =
        override === undefined
          ? providerCache
          : normalizeCacheConfig(override as CacheOption);
      return applyCacheControl(body, config);
    },
  });

  // The callable interface: doubleword("model-id") -> LanguageModelV3
  const callable = function (modelId: string): LanguageModelV3 {
    return provider.chatModel(modelId);
  };

  callable.languageModel = function (modelId: string): LanguageModelV3 {
    return provider.chatModel(modelId);
  };

  callable.chatModel = function (modelId: string): LanguageModelV3 {
    return provider.chatModel(modelId);
  };

  callable.embeddingModel = function (modelId: string): EmbeddingModelV3 {
    return provider.textEmbeddingModel(modelId);
  };

  callable.textEmbeddingModel = function (modelId: string): EmbeddingModelV3 {
    return provider.textEmbeddingModel(modelId);
  };

  return callable as DoublewordProvider;
}
