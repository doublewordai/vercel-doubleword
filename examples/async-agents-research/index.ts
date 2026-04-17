/**
 * Recursive multi-agent research orchestrator.
 *
 * A root agent breaks a topic into sub-queries, spawns parallel sub-agents
 * (each of which can recursively spawn its own sub-agents up to MAX_DEPTH),
 * and synthesises a final report. All concurrent LLM calls are automatically
 * batched via `createDoublewordBatch`.
 *
 * Requires DOUBLEWORD_API_KEY and SERPER_API_KEY in the environment.
 */

import { createDoublewordBatch } from "@doubleword/vercel-ai";
import { generateText, tool, jsonSchema, stepCountIs } from "ai";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { ROOT_AGENT_SYSTEM, SUB_AGENT_SYSTEM } from "./prompts.js";
import {
  search as serperSearch,
  fetchUrls,
  formatResultsForContext,
  type SearchResponse,
} from "./tools.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TOPIC = process.argv[2] ?? "quantum computing error correction";
const MODEL = process.env.MODEL ?? "Qwen/Qwen3.5-397B-A17B-FP8";
const MAX_DEPTH = 3;
const MAX_STEPS = 8;
const OUTPUT_DIR = join("results", TOPIC.toLowerCase().replace(/\s+/g, "-").slice(0, 50));

// ---------------------------------------------------------------------------
// Batch provider
// ---------------------------------------------------------------------------

const dw = createDoublewordBatch({ batchWindowSeconds: 2.5 });

// ---------------------------------------------------------------------------
// Session registry
// ---------------------------------------------------------------------------

interface AgentEntry {
  agentId: string;
  parentId: string | null;
  depth: number;
  isRoot: boolean;
  topic: string;
  status: "in_progress" | "completed" | "incomplete";
  findings: string;
  sources: Array<{ url: string; title: string }>;
  iterations: number;
  startedAt: number;
  completedAt: number | null;
}

const SESSION_REGISTRY = new Map<string, AgentEntry>();
let sessionStart = 0;
let idCounter = 0;

function elapsed(): number {
  return (performance.now() - sessionStart) / 1000;
}

function resetSession(): void {
  SESSION_REGISTRY.clear();
  sessionStart = performance.now();
  idCounter = 0;
}

function nextAgentId(prefix: string): string {
  return `${prefix}-${idCounter++}`;
}

function registerAgent(
  agentId: string,
  parentId: string | null,
  depth: number,
  isRoot: boolean,
  topic: string,
): void {
  SESSION_REGISTRY.set(agentId, {
    agentId,
    parentId,
    depth,
    isRoot,
    topic,
    status: "in_progress",
    findings: "",
    sources: [],
    iterations: 0,
    startedAt: elapsed(),
    completedAt: null,
  });
}

function updateAgent(agentId: string, fields: Partial<AgentEntry>): void {
  const entry = SESSION_REGISTRY.get(agentId);
  if (entry) Object.assign(entry, fields);
}

function buildSessionContext(forAgentId: string): string {
  const lines = ["Other agents in this research session:"];
  for (const [aid, entry] of SESSION_REGISTRY) {
    if (aid === forAgentId) continue;
    const hasFindings = entry.findings ? "yes" : "no";
    const topic = entry.topic.slice(0, 80);
    lines.push(
      `  - ${aid} [${entry.status}] (findings: ${hasFindings}): ${topic}`,
    );
  }
  if (lines.length === 1) return "";
  lines.push(
    "",
    "Use reference_findings(agent_id) to reuse another agent's research instead of re-searching the same topic.",
  );
  return lines.join("\n");
}

function logEvent(agentId: string, msg: string): void {
  const entry = SESSION_REGISTRY.get(agentId);
  const depth = entry?.depth ?? 0;
  const indent = "  ".repeat(depth);
  console.log(
    `[${elapsed().toFixed(1).padStart(6)}s] ${indent}${agentId.padEnd(14)} ${msg}`,
  );
}

// ---------------------------------------------------------------------------
// Agent runner
// ---------------------------------------------------------------------------

interface AgentResult {
  agentId: string;
  topic: string;
  findings: string;
  report: string | null;
  sources: Array<{ url: string; title: string }>;
}

async function runAgent(
  topic: string,
  isRoot: boolean,
  parentId: string | null = null,
  depth: number = 0,
): Promise<AgentResult> {
  const agentId = nextAgentId(isRoot ? "root" : "sub");
  registerAgent(agentId, parentId, depth, isRoot, topic);

  // ---- Search-first: pre-search before creating the agent ----
  let preSearchContext = "";
  try {
    const results = await serperSearch(topic);
    preSearchContext = formatResultsForContext(topic, results);
  } catch (e) {
    preSearchContext = `Initial search failed (${e}). Use the search tool instead.`;
  }

  const systemPrompt = isRoot ? ROOT_AGENT_SYSTEM : SUB_AGENT_SYSTEM;
  const userText = isRoot
    ? `Research the following topic and produce a comprehensive report: ${topic}`
    : `Research the following topic thoroughly: ${topic}`;

  // ---- Collected state across steps ----
  let allSources: Array<{ url: string; title: string }> = [];
  let report: string | null = null;
  let findings = "";

  // ---- Build tools ----

  const searchTool = tool({
    description:
      "Search the web for a specific angle or follow-up query. " +
      "Your topic was already searched — only use this for NEW queries.",
    inputSchema: jsonSchema<{ query: string; maxResults?: number }>({
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        maxResults: {
          type: "number",
          description: "Maximum results (default 5)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: async ({ query, maxResults }) => {
      try {
        const result = await serperSearch(query, maxResults ?? 5);
        return JSON.stringify(result);
      } catch (e) {
        return JSON.stringify({ error: String(e) });
      }
    },
  });

  const readPagesTool = tool({
    description:
      "Read one or more web pages in parallel. Returns each page's content " +
      "as markdown (truncated to 4000 chars each). Pass ALL URLs at once.",
    inputSchema: jsonSchema<{ urls: string[] }>({
      type: "object",
      properties: {
        urls: {
          type: "array",
          items: { type: "string" },
          description: "URLs to fetch",
        },
      },
      required: ["urls"],
      additionalProperties: false,
    }),
    execute: async ({ urls }) => {
      if (!urls || urls.length === 0) {
        return JSON.stringify({ error: "No URLs provided" });
      }
      const fetched = await fetchUrls(urls);
      const pages: Array<Record<string, string>> = [];
      for (const url of urls) {
        const content = fetched[url];
        if (content) {
          pages.push({ url, content: content.slice(0, 4000) });
          const title = content.slice(0, 100).split("\n")[0];
          allSources.push({ url, title });
        } else {
          pages.push({ url, error: `Failed to fetch ${url}` });
        }
      }
      return JSON.stringify({ pages });
    },
  });

  const spawnAgentsTool = tool({
    description:
      "Spawn parallel sub-agents to research different topics independently. " +
      "Each sub-agent gets automatic web search results and works in parallel. " +
      "Prefer this over calling search multiple times.",
    inputSchema: jsonSchema<{ queries: string[] }>({
      type: "object",
      properties: {
        queries: {
          type: "array",
          items: { type: "string" },
          description: "Research topics for sub-agents",
        },
      },
      required: ["queries"],
      additionalProperties: false,
    }),
    execute: async ({ queries }) => {
      if (depth >= MAX_DEPTH) {
        return JSON.stringify({
          error: `Maximum depth (${MAX_DEPTH}) reached. Research directly using search and read_pages instead.`,
        });
      }
      if (!queries || queries.length === 0) {
        return JSON.stringify({ error: "No queries provided" });
      }

      logEvent(
        agentId,
        `spawn ${queries.length} children: ${queries.map((q) => q.slice(0, 30)).join(", ")}`,
      );

      const childResults = await Promise.all(
        queries.map((q) => runAgent(q, false, agentId, depth + 1)),
      );

      for (const child of childResults) {
        allSources.push(...child.sources);
      }

      const compiled = childResults.map((child) => ({
        agent_id: child.agentId,
        topic: child.topic,
        findings: child.findings || "(no findings)",
        verified_sources: child.sources,
      }));
      return JSON.stringify({ sub_agent_results: compiled });
    },
  });

  const referenceFindingsTool = tool({
    description:
      "Reference the findings of another agent that has already researched " +
      "a similar topic. Check the 'Other agents' block in your context.",
    inputSchema: jsonSchema<{ agent_id: string }>({
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "ID of the agent to reference",
        },
      },
      required: ["agent_id"],
      additionalProperties: false,
    }),
    execute: async ({ agent_id }) => {
      const entry = SESSION_REGISTRY.get(agent_id);
      if (entry && entry.findings) {
        logEvent(agentId, `reference_findings(${agent_id}): hit`);
        return JSON.stringify({
          agent_id,
          status: entry.status,
          findings: entry.findings,
        });
      }
      logEvent(agentId, `reference_findings(${agent_id}): miss`);
      return JSON.stringify({
        error: `Agent ${agent_id} not found or has no findings yet.`,
      });
    },
  });

  const writeReportTool = tool({
    description:
      "Write the final research report. Call this when you have gathered all " +
      "findings and are ready to produce the final output.",
    inputSchema: jsonSchema<{ report: string }>({
      type: "object",
      properties: {
        report: {
          type: "string",
          description: "The complete markdown research report",
        },
      },
      required: ["report"],
      additionalProperties: false,
    }),
    execute: async ({ report: r }) => {
      report = r;
      updateAgent(agentId, {
        status: "completed",
        findings: r,
        completedAt: elapsed(),
      });
      logEvent(agentId, "write_report");
      return JSON.stringify({ status: "Report saved" });
    },
  });

  // ---- Build tool sets ----
  const rootTools = {
    search: searchTool,
    read_pages: readPagesTool,
    spawn_agents: spawnAgentsTool,
    reference_findings: referenceFindingsTool,
    write_report: writeReportTool,
  };

  const subTools = {
    search: searchTool,
    read_pages: readPagesTool,
    spawn_agents: spawnAgentsTool,
    reference_findings: referenceFindingsTool,
  };

  // ---- Build system messages with pre-search + session context ----
  const sessionContext = buildSessionContext(agentId);
  const systemParts = [systemPrompt];
  if (preSearchContext) {
    systemParts.push(`\nInitial search results for your topic:\n\n${preSearchContext}`);
  }
  if (sessionContext) {
    systemParts.push(`\n${sessionContext}`);
  }

  logEvent(agentId, "start");

  // ---- Run the agentic loop via generateText ----
  const result = await generateText({
    model: dw(MODEL),
    system: systemParts.join("\n"),
    prompt: userText,
    tools: isRoot ? rootTools : subTools,
    stopWhen: stepCountIs(MAX_STEPS),
    maxRetries: 0,
    temperature: 0,
    maxTokens: 4096,
  });

  findings = report || result.text || "";

  // Mark completed if not already done by write_report
  if (SESSION_REGISTRY.get(agentId)?.status === "in_progress") {
    updateAgent(agentId, {
      status: "completed",
      findings,
      sources: allSources,
      completedAt: elapsed(),
    });
  } else {
    updateAgent(agentId, { sources: allSources });
  }

  logEvent(agentId, "done");

  return {
    agentId,
    topic,
    findings,
    report,
    sources: allSources,
  };
}

// ---------------------------------------------------------------------------
// Synthesis fallback
// ---------------------------------------------------------------------------

const SYNTHESIS_PROMPT = `\
All research is now complete. Based on all the findings above, write a \
comprehensive, well-structured research report in markdown. Include an \
executive summary, thematic sections with source citations, areas where \
sources disagree, and areas for further research.

CITATION RULES:
- Only cite URLs from the verified sources list below.
- Do not cite URLs from search snippets or invent URLs.
- If a finding has no verified URL, state it without a link.

Output ONLY the report — no preamble or commentary.`;

async function synthesizeReport(
  agentResult: AgentResult,
): Promise<string> {
  // De-dupe sources
  const seenUrls = new Set<string>();
  const uniqueSources = agentResult.sources.filter((s) => {
    if (seenUrls.has(s.url)) return false;
    seenUrls.add(s.url);
    return true;
  });

  let sourcesBlock = "";
  if (uniqueSources.length > 0) {
    const sourceLines = uniqueSources.map(
      (s) => `- [${s.title}](${s.url})`,
    );
    sourcesBlock =
      "\n\nVERIFIED SOURCES — these URLs were actually fetched and " +
      "read during research. Use ONLY these for citations:\n" +
      sourceLines.join("\n");
  }

  const prompt =
    `Here are the research findings:\n\n${agentResult.findings}\n\n` +
    SYNTHESIS_PROMPT +
    sourcesBlock;

  const result = await generateText({
    model: dw(MODEL),
    prompt,
    maxRetries: 0,
    temperature: 0,
    maxTokens: 4096,
  });

  return result.text;
}

// ---------------------------------------------------------------------------
// Tree printing
// ---------------------------------------------------------------------------

function printTree(): void {
  const childrenByParent = new Map<string | null, string[]>();
  for (const [aid, entry] of SESSION_REGISTRY) {
    const parent = entry.parentId ?? null;
    const list = childrenByParent.get(parent) ?? [];
    list.push(aid);
    childrenByParent.set(parent, list);
  }

  const STATUS_ICON: Record<string, string> = {
    in_progress: "o",
    completed: "*",
    incomplete: "~",
  };

  function walk(aid: string, prefix: string, isLast: boolean): void {
    const entry = SESSION_REGISTRY.get(aid)!;
    const connector = isLast ? "\\-- " : "|-- ";
    const icon = STATUS_ICON[entry.status] ?? "?";
    const topic = entry.topic.slice(0, 60);
    const time = (entry.completedAt ?? 0).toFixed(1);
    console.log(
      `  ${prefix}${connector}${icon} ${aid} (${time}s) ${topic}`,
    );
    const children = childrenByParent.get(aid) ?? [];
    const newPrefix = prefix + (isLast ? "   " : "|  ");
    for (let i = 0; i < children.length; i++) {
      walk(children[i], newPrefix, i === children.length - 1);
    }
  }

  const roots = childrenByParent.get(null) ?? [];
  for (const rid of roots) {
    walk(rid, "", true);
  }
}

// ---------------------------------------------------------------------------
// Output files
// ---------------------------------------------------------------------------

function writeOutputFiles(report: string): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // agent-tree.json
  const agents = Array.from(SESSION_REGISTRY.values());
  writeFileSync(
    join(OUTPUT_DIR, "agent-tree.json"),
    JSON.stringify(agents, null, 2),
  );

  // summary.json
  const counts: Record<string, number> = {};
  let maxDepth = 0;
  for (const entry of agents) {
    counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    if (entry.depth > maxDepth) maxDepth = entry.depth;
  }
  const summary = {
    topic: TOPIC,
    model: MODEL,
    totalAgents: agents.length,
    byStatus: counts,
    maxDepth,
    elapsedSeconds: elapsed(),
  };
  writeFileSync(
    join(OUTPUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
  );

  // report.md
  writeFileSync(join(OUTPUT_DIR, "report.md"), report);

  console.log(
    `\nWrote ${join(OUTPUT_DIR, "report.md")}, agent-tree.json, summary.json`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env.SERPER_API_KEY) {
    console.error("SERPER_API_KEY environment variable must be set");
    process.exit(1);
  }

  resetSession();

  console.log("=".repeat(60));
  console.log("@doubleword/vercel-ai — recursive research agents");
  console.log(`Topic: ${TOPIC}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Max depth: ${MAX_DEPTH}`);
  console.log("=".repeat(60));
  console.log();

  // Run the recursive agent tree
  const result = await runAgent(TOPIC, true);

  // Force-complete any agents still in progress
  for (const [, entry] of SESSION_REGISTRY) {
    if (entry.status === "in_progress") {
      entry.status = "incomplete";
      if (!entry.findings) {
        entry.findings = "Max iterations reached before completion.";
      }
      entry.completedAt = elapsed();
    }
  }

  // If the root didn't produce a report, run synthesis fallback
  let finalReport = result.report ?? "";
  if (!finalReport) {
    console.log();
    console.log(
      "Root did not call write_report; running synthesis fallback...",
    );
    finalReport = await synthesizeReport(result);
    updateAgent(result.agentId, {
      status: "completed",
      findings: finalReport,
      completedAt: elapsed(),
    });
  }

  // Flush all pending batches
  await dw.close();

  // Print results
  console.log();
  console.log("=".repeat(60));
  console.log(`Topic: ${TOPIC}`);
  console.log(`Total agents: ${SESSION_REGISTRY.size}`);
  console.log(`Sources collected: ${result.sources.length}`);
  console.log("=".repeat(60));
  console.log();
  printTree();

  writeOutputFiles(finalReport);

  console.log();
  console.log("=".repeat(60));
  console.log("REPORT");
  console.log("=".repeat(60));
  console.log(finalReport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
