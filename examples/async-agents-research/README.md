# Async Agents — Vercel AI SDK Edition

A `@doubleword/vercel-ai` adaptation of the
[Doubleword async-agents workbook](https://docs.doubleword.ai/inference-api/async-agents).

The original (~1200 lines) hand-rolls every piece of the orchestrator:
JSONL batch construction, file upload, batch creation, polling, downloading
results, parsing finish reasons, dispatching tools, tracking agent state,
resolving waiting parents. This adaptation deletes essentially all of it
by leaning on two pieces of infrastructure:

1. **`createDoublewordBatch`** — every concurrent `generateText` call is
   collected by `autobatcher` and submitted as a single batch through
   Doubleword's batch API. There is no JSONL on disk, no batch ID to track,
   no polling loop.
2. **AI SDK `generateText` with tools** — the agent loop uses the Vercel AI
   SDK's built-in multi-step tool calling (`stopWhen: stepCountIs(N)`).
   Recursive sub-agent spawning is just `runAgent()` called from inside a
   `spawn_agents` tool execution, fanned out via `Promise.all`. All in-flight
   calls — root, sub, sub-sub — hit the same batch provider and get collated
   into the same autobatcher windows.

## What it does

1. Takes a topic (from the command line or default)
2. Pre-searches it via Serper API
3. Root agent reviews results and spawns sub-agents for distinct research angles
4. Sub-agents can recursively spawn more sub-agents (up to `MAX_DEPTH=3`)
5. All agents can: search the web, read pages (Jina Reader), spawn sub-agents,
   reference other agents' findings
6. Root agent writes a final report (with synthesis fallback if it doesn't)
7. Outputs: markdown report + JSON agent tree + summary

## What's the same as the LangGraph edition

- Search-first agent creation (search runs at agent creation time, results
  injected into the first prompt — minimizes batch rounds per agent)
- Same five tools: `search`, `read_pages`, `spawn_agents`,
  `reference_findings`, `write_report`
- Same prompts (copied from the original)
- Same Serper / Jina HTTP wrappers
- Same recursive agent tree architecture

## What's different

- TypeScript instead of Python
- Vercel AI SDK `generateText` instead of LangGraph `StateGraph`
- No graph definition, no state reducers — just recursive async functions
- `createDoublewordBatch` instead of `ChatDoublewordBatch`
- CLI script instead of notebook

## Prerequisites

```bash
export DOUBLEWORD_API_KEY="sk-..."  # or use ~/.dw/credentials.toml
export SERPER_API_KEY="..."          # https://serper.dev
```

## Running

```bash
cd examples/async-agents-research
npm install
npm start
```

Or with a custom topic:

```bash
npx tsx index.ts "artificial general intelligence safety"
```

To use a different model:

```bash
MODEL="Qwen/Qwen3.5-397B-A17B-FP8" npx tsx index.ts "quantum computing"
```

## Output

Results are written to `results/<topic>/`:

```
results/quantum-computing-error-correction/
├── report.md         # Final markdown research report
├── agent-tree.json   # Full agent hierarchy with findings
└── summary.json      # Aggregate stats (agent count, timing, etc.)
```

## Layout

```
async-agents-research/
├── package.json
├── README.md          <- you are here
├── index.ts           <- main orchestrator
├── prompts.ts         <- root and sub-agent system prompts
└── tools.ts           <- Serper search + Jina Reader wrappers
```
