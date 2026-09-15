// Sends one long, stable system prompt twice. The second call reads the cached prefix.
// Requires DOUBLEWORD_API_KEY in the environment (or ~/.dw/credentials.toml).

import { createDoubleword } from "@doubleword/vercel-ai";
import { generateText } from "ai";

const MODEL = "Qwen/Qwen3.5-397B-A17B-FP8";

// The prefix must reach the model's minimum cacheable length (1,024 tokens on most models).
const SYSTEM = [
  "You are a support assistant for Acme Corp. Answer only from the policy below and cite the policy number.",
  ...Array.from(
    { length: 200 },
    (_, i) => `Policy ${i + 1}: be concise and accurate, and never invent details not in the policy.`,
  ),
].join("\n");

const doubleword = createDoubleword({ cacheControl: { type: "ephemeral", ttl: "1h" } });
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
