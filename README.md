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

The provider supports multi-step tool use via `generateText` with `maxSteps`.
The model decides when to call tools, receives the results, and formulates a
final answer:

```typescript
import { createDoubleword } from "@doubleword/vercel-ai";
import { generateText, tool } from "ai";
import { z } from "zod";

const doubleword = createDoubleword();

const result = await generateText({
  model: doubleword("your-model-name"),
  tools: {
    calculator: tool({
      description: "Evaluate a basic arithmetic expression",
      parameters: z.object({
        expression: z.string().describe("The expression to evaluate"),
      }),
      execute: async ({ expression }) => {
        return String(new Function(`return (${expression})`)());
      },
    }),
  },
  maxSteps: 5,
  prompt: "What is 137 * 49?",
});

console.log(result.text);
```

`maxSteps` controls how many model→tool→model round-trips the SDK will run
before returning. Each step where the model calls a tool automatically feeds
the result back for the next step.

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
