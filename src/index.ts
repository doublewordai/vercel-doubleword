export {
  createDoubleword,
  type DoublewordProvider,
  type DoublewordProviderOptions,
} from "./doubleword-provider.js";
export { resolveApiKey, resolveBaseURL } from "./credentials.js";
export { VERSION } from "./version.js";
export {
  createDoublewordBatch,
  type DoublewordBatchProvider,
  type DoublewordBatchProviderOptions,
} from "./batch-provider.js";

// Default singleton -- lazily resolved credentials on first use.
import { createDoubleword } from "./doubleword-provider.js";

/**
 * Default Doubleword provider singleton.
 *
 * Uses `DOUBLEWORD_API_KEY` env var or `~/.dw/credentials.toml` for
 * authentication, and `DOUBLEWORD_API_BASE` or `https://api.doubleword.ai/v1`
 * as the base URL.
 *
 * @example
 * ```ts
 * import { doubleword } from "@doubleword/vercel-ai";
 * import { generateText } from "ai";
 *
 * const { text } = await generateText({
 *   model: doubleword("gpt-4o"),
 *   prompt: "Hello!",
 * });
 * ```
 */
export const doubleword = createDoubleword();
