/**
 * Prompt-caching example using @doubleword/vercel-ai.
 *
 * Doubleword reuses a repeated prompt prefix: the first request stores the
 * processed prefix, later requests read it back cheaply instead of
 * recomputing it. This runs one large, stable system prompt twice, the cold
 * call fills the cache, the warm call reads it, which shows up in
 * `usage.inputTokenDetails`.
 *
 * Requires DOUBLEWORD_API_KEY in the environment (or ~/.dw/credentials.toml).
 */

import { createDoubleword } from "@doubleword/vercel-ai";
import { generateText } from "ai";

const MODEL = "Qwen/Qwen3.5-397B-A17B-FP8";

// Caching is for the big, stable prefix (there is a ~1024-token floor), so a
// one-line system prompt will not cache. Here the policy reference is large
// and identical across calls.
const SYSTEM = [
  "You are a support assistant for Acme Corp. Answer only from the policy below and cite the policy number.",
  ...Array.from(
    { length: 200 },
    (_, i) => `Policy ${i + 1}: be concise and accurate, and never invent details not in the policy.`,
  ),
].join("\n");

// Automatic mode: cache the system prefix for one hour.
const doubleword = createDoubleword({ cache: { ttl: "1h" } });
const model = doubleword(MODEL);

async function ask(question: string, label: string): Promise<void> {
  const { text, usage } = await generateText({
    model,
    system: SYSTEM,
    prompt: question,
    maxOutputTokens: 128,
  });
  const details = usage.inputTokenDetails;
  const cacheRead = details?.cacheReadTokens ?? 0;
  const fresh = details?.noCacheTokens ?? usage.inputTokens ?? 0;
  console.log(
    `${label}  cache_read=${cacheRead}  fresh=${fresh}  ->  ${text.trim().slice(0, 60) || "(no text)"}`,
  );
}

await ask("What does policy 12 say?", "cold");
await new Promise((r) => setTimeout(r, 1500));
await ask("What does policy 40 say?", "warm");

// Explicit, per request: enable or override caching for a single call without
// a provider-level default (pass `cacheControl: false` to skip it):
//
//   await generateText({
//     model,
//     system: SYSTEM,
//     prompt: "...",
//     providerOptions: {
//       doubleword: { cacheControl: { ttl: "1h", scope: "system" } },
//     },
//   });
