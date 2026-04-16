# @doubleword/vercel-ai

A [Vercel AI SDK](https://sdk.vercel.ai) provider for [Doubleword](https://doubleword.ai).

This package wires Doubleword's OpenAI-compatible inference API
(`https://api.doubleword.ai/v1`) into the Vercel AI SDK as a custom provider,
with automatic API key resolution and a pre-configured base URL.

## Installation

```bash
npm install @doubleword/vercel-ai ai
```

## Authentication

Three resolution paths, in precedence order:

1. **Explicit option**:
   ```typescript
   const doubleword = createDoubleword({ apiKey: "sk-..." });
   ```
2. **Environment variable**:
   ```bash
   export DOUBLEWORD_API_KEY=sk-...
   ```
3. **`~/.dw/credentials.toml`** — the same file written by Doubleword's CLI
   tooling. The active account is selected by `~/.dw/config.toml`'s
   `active_account` field, and `inference_key` from that account is used.

   ```toml
   # ~/.dw/config.toml
   active_account = "work"
   ```
   ```toml
   # ~/.dw/credentials.toml
   [accounts.work]
   inference_key = "sk-..."
   ```

## Language models

### Text generation

```typescript
import { createDoubleword } from "@doubleword/vercel-ai";
import { generateText } from "ai";

const doubleword = createDoubleword();

const result = await generateText({
  model: doubleword("your-model-name"),
  prompt: "Explain bismuth in three sentences.",
});

console.log(result.text);
```

### Streaming

```typescript
import { createDoubleword } from "@doubleword/vercel-ai";
import { streamText } from "ai";

const doubleword = createDoubleword();

const stream = streamText({
  model: doubleword("your-model-name"),
  prompt: "Explain bismuth in three sentences.",
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Tool calling

The provider supports multi-step tool use via `generateText`. The model decides
when to call tools, receives the results, and formulates a final answer:

```typescript
import { createDoubleword } from "@doubleword/vercel-ai";
import { generateText, tool, jsonSchema, stepCountIs } from "ai";

const doubleword = createDoubleword();

const result = await generateText({
  model: doubleword("your-model-name"),
  tools: {
    calculator: tool({
      description: "Evaluate a basic arithmetic expression",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          expression: { type: "string", description: "The expression to evaluate" },
        },
        required: ["expression"],
        additionalProperties: false,
      }),
      execute: async ({ expression }: { expression: string }) => {
        return String(new Function(`return (${expression})`)());
      },
    }),
  },
  stopWhen: stepCountIs(5),
  prompt: "What is 137 * 49?",
});

console.log(result.text);
```

`stopWhen: stepCountIs(5)` allows up to 5 model→tool→model round-trips before
returning. Each step where the model calls a tool automatically feeds the
result back for the next step.

## Embeddings

```typescript
import { createDoubleword } from "@doubleword/vercel-ai";
import { embed } from "ai";

const doubleword = createDoubleword();

const result = await embed({
  model: doubleword.embeddingModel("your-embedding-model"),
  value: "Hello world",
});

console.log(result.embedding.length);
```

## Batch pricing with `createDoublewordBatch`

For background workloads where latency is not critical, use the batch provider
to transparently route requests through the
[Doubleword Inference API](https://docs.doubleword.ai) Batch API — cutting
inference costs by up to 90%. Powered by
[`autobatcher`](https://www.npmjs.com/package/autobatcher) under the hood.

```typescript
import { createDoublewordBatch } from "@doubleword/vercel-ai";
import { generateText } from "ai";

const doubleword = createDoublewordBatch({
  batchWindowSeconds: 2.5,     // don't wait the full 10s to submit
});

const result = await generateText({
  model: doubleword("your-model-name"),
  prompt: "Summarize this document.",
});

console.log(result.text);

// When done, flush remaining requests and wait for completion
await doubleword.close();
```

Concurrent `generateText` calls are automatically collected into batch
submissions. The interface is identical to the real-time provider — only
streaming is not supported (batch results return all at once).

### Tuning the batch client

| Option                | Default | Purpose                                                              |
|-----------------------|---------|----------------------------------------------------------------------|
| `batchSize`           | `1000`  | Submit a batch when this many requests are queued.                   |
| `batchWindowSeconds`  | `10`    | Submit after this many seconds even if the size cap is not reached.  |
| `pollIntervalSeconds` | `5`     | How often to poll for batch completion.                              |
| `completionWindow`    | `"1h"`  | `"1h"` async inference (default), `"24h"` batch inference for max savings. |

## Default singleton

For convenience, a pre-configured singleton is also exported that reads
`DOUBLEWORD_API_KEY` from the environment:

```typescript
import { doubleword } from "@doubleword/vercel-ai";
import { generateText } from "ai";

const result = await generateText({
  model: doubleword("your-model-name"),
  prompt: "Say hello.",
});
```

## Configuration

| Option    | Env var              | Default                          |
|-----------|----------------------|----------------------------------|
| `apiKey`  | `DOUBLEWORD_API_KEY` | _required_                       |
| `baseURL` | `DOUBLEWORD_API_BASE`| `https://api.doubleword.ai/v1`   |
| `headers` | —                    | `{}`                             |

The provider is built on top of `@ai-sdk/openai-compatible`, so all standard
Vercel AI SDK features (`generateText`, `streamText`, `generateObject`,
`embed`, etc.) work unchanged.

## License

Apache-2.0
