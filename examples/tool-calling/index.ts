/**
 * Tool-calling agent example using @doubleword/vercel-ai.
 *
 * A simple agent that uses a calculator tool to answer arithmetic questions.
 * The model decides when to call the tool, receives the result, and
 * formulates a final answer — demonstrating a basic agentic loop.
 *
 * Requires DOUBLEWORD_API_KEY in the environment (or ~/.dw/credentials.toml).
 */

import { createDoubleword } from "@doubleword/vercel-ai";
import { generateText, tool, jsonSchema, stepCountIs } from "ai";

const MODEL = "Qwen/Qwen3-14B-FP8";

const doubleword = createDoubleword();

const calculator = tool({
  description:
    "Evaluate a basic arithmetic expression. Supports +, -, *, /, **, parentheses, and numbers.",
  inputSchema: jsonSchema({
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "The arithmetic expression to evaluate, e.g. '137 * 49'",
      },
    },
    required: ["expression"],
    additionalProperties: false,
  }),
  execute: async ({ expression }: { expression: string }) => {
    // Only allow safe arithmetic characters
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      return `error: invalid characters in "${expression}"`;
    }
    try {
      const result = new Function(`return (${expression})`)();
      return String(result);
    } catch (e) {
      return `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

const QUERIES = [
  "What is 137 * 49?",
  "What is 100 + 250?",
  "What is 81 / 9?",
  "What is 2 ** 10?",
  "What is 1000 - 333?",
];

async function runOne(query: string): Promise<string> {
  const result = await generateText({
    model: doubleword(MODEL),
    tools: { calculator },
    stopWhen: stepCountIs(5),
    prompt: query,
  });
  return result.text;
}

async function main() {
  console.log("=".repeat(60));
  console.log("@doubleword/vercel-ai — tool-calling example");
  console.log(`Model: ${MODEL}`);
  console.log("=".repeat(60));
  console.log();

  // Single query
  console.log("--- single query ---");
  const start = performance.now();
  const answer = await runOne(QUERIES[0]);
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`  wall time: ${elapsed}s`);
  console.log(`  Q: ${QUERIES[0]}`);
  console.log(`  A: ${answer.slice(0, 120)}`);
  console.log();

  // Concurrent queries
  console.log(`--- ${QUERIES.length} queries (concurrent) ---`);
  const startAll = performance.now();
  const answers = await Promise.all(QUERIES.map(runOne));
  const elapsedAll = ((performance.now() - startAll) / 1000).toFixed(1);
  console.log(`  wall time: ${elapsedAll}s`);
  for (let i = 0; i < QUERIES.length; i++) {
    console.log(`  Q: ${QUERIES[i]}`);
    console.log(`  A: ${answers[i].slice(0, 120)}`);
  }
  console.log();
}

main().catch(console.error);
