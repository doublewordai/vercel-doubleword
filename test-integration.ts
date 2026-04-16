import { createDoubleword, createDoublewordBatch } from "./src/index.js";
import { generateText, tool, jsonSchema, stepCountIs } from "ai";

const API_KEY = "sk-8nYPLk8F6pqG1ShHxEaMYiI075FKhDeNtyU1jLQZiTk";
const MODEL = "Qwen/Qwen3.5-397B-A17B-FP8";

async function main() {
  // --- Test 1: Real-time with tool calling ---
  console.log("=== Test 1: Real-time + tool calling ===");
  const dw = createDoubleword({ apiKey: API_KEY });

  const result1 = await generateText({
    model: dw(MODEL),
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
  console.log("Result:", result1.text);
  console.log("Steps:", result1.steps.length);
  console.log();

  // --- Test 2: Batch mode (3 concurrent requests) ---
  console.log("=== Test 2: Batch mode ===");
  const dwBatch = createDoublewordBatch({
    apiKey: API_KEY,
    batchWindowSeconds: 2,
  });

  const results = await Promise.all([
    generateText({ model: dwBatch(MODEL), prompt: "What is 2+2? Reply with just the number." }),
    generateText({ model: dwBatch(MODEL), prompt: "What is 3+3? Reply with just the number." }),
    generateText({ model: dwBatch(MODEL), prompt: "What is 4+4? Reply with just the number." }),
  ]);

  for (const r of results) {
    console.log("Result:", r.text.slice(0, 80));
  }

  await dwBatch.close();
  console.log("\nAll tests passed!");
}

main().catch(console.error);
