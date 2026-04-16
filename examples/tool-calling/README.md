# tool-calling

A minimal tool-calling agent using `@doubleword/vercel-ai` and the Vercel AI
SDK's `generateText` with `maxSteps`.

The model receives an arithmetic question, decides to call the `calculator`
tool, receives the result, and formulates a final answer. This demonstrates a
basic agentic loop — the model autonomously decides when and how to use
tools.

| File       | Description                                           |
|------------|-------------------------------------------------------|
| `index.ts` | Single-file agent with calculator tool and multi-step |

## Running

```bash
export DOUBLEWORD_API_KEY="sk-..."   # or use ~/.dw/credentials.toml

cd examples/tool-calling
npm install
npx tsx index.ts
```

Edit `MODEL` at the top of `index.ts` to point at whichever model you have
access to.
