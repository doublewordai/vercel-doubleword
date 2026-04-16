/**
 * Batch provider for the Vercel AI SDK.
 *
 * Uses `BatchOpenAI` from the `autobatcher` package to transparently batch
 * inference requests through the Doubleword Batch API. Language model
 * `doGenerate` calls are routed through the batching client instead of making
 * individual HTTP requests. Streaming is not supported in batch mode.
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider";

import { BatchOpenAI } from "autobatcher";
import {
  createDoubleword,
  type DoublewordProvider,
  type DoublewordProviderOptions,
} from "./doubleword-provider.js";
import { resolveApiKey, resolveBaseURL } from "./credentials.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoublewordBatchProviderOptions extends DoublewordProviderOptions {
  /** Maximum requests per batch before auto-flush (default 1000). */
  batchSize?: number;
  /** Seconds to wait before flushing a partial batch (default 10). */
  batchWindowSeconds?: number;
  /** Seconds between poll ticks when waiting for batch completion (default 5). */
  pollIntervalSeconds?: number;
  /** Completion window: "1h" for async inference (default), "24h" for batch inference. */
  completionWindow?: string;
}

export interface DoublewordBatchProvider extends DoublewordProvider {
  /**
   * Close the underlying batch client, flushing any pending requests and
   * waiting for all in-flight batches to complete.
   */
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Prompt conversion (AI SDK V3 prompt -> OpenAI messages format)
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: string;
  content: string | Array<Record<string, unknown>>;
  tool_calls?: Array<Record<string, unknown>>;
  tool_call_id?: string;
  name?: string;
}

function convertPrompt(
  prompt: LanguageModelV3CallOptions["prompt"],
): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];

  for (const msg of prompt) {
    switch (msg.role) {
      case "system":
        messages.push({ role: "system", content: msg.content });
        break;

      case "user": {
        const parts = msg.content;
        if (parts.length === 1 && parts[0].type === "text") {
          messages.push({ role: "user", content: parts[0].text });
        } else {
          messages.push({
            role: "user",
            content: parts.map((p) => {
              if (p.type === "text") {
                return { type: "text", text: p.text };
              }
              if (p.type === "file") {
                if (p.data instanceof URL) {
                  return {
                    type: "image_url",
                    image_url: { url: p.data.toString() },
                  };
                }
                const base64 =
                  typeof p.data === "string"
                    ? p.data
                    : Buffer.from(p.data).toString("base64");
                return {
                  type: "image_url",
                  image_url: {
                    url: `data:${p.mediaType};base64,${base64}`,
                  },
                };
              }
              return { type: "text", text: "" };
            }),
          });
        }
        break;
      }

      case "assistant": {
        const textParts = msg.content.filter(
          (p): p is Extract<(typeof msg.content)[number], { type: "text" }> =>
            p.type === "text",
        );
        const toolCallParts = msg.content.filter(
          (p): p is Extract<(typeof msg.content)[number], { type: "tool-call" }> =>
            p.type === "tool-call",
        );

        const assistantMsg: OpenAIMessage = {
          role: "assistant",
          content: textParts.map((p) => p.text).join(""),
        };

        if (toolCallParts.length > 0) {
          assistantMsg.tool_calls = toolCallParts.map((tc) => ({
            id: tc.toolCallId,
            type: "function",
            function: {
              name: tc.toolName,
              arguments:
                typeof tc.input === "string"
                  ? tc.input
                  : JSON.stringify(tc.input),
            },
          }));
        }

        messages.push(assistantMsg);
        break;
      }

      case "tool": {
        for (const part of msg.content) {
          if (part.type === "tool-result") {
            let content: string;
            if (part.output.type === "text") {
              content = part.output.value;
            } else if (part.output.type === "json") {
              content = JSON.stringify(part.output.value);
            } else {
              content = "";
            }
            messages.push({
              role: "tool",
              tool_call_id: part.toolCallId,
              content,
            });
          }
        }
        break;
      }
    }
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Build OpenAI-compatible request body from AI SDK call options
// ---------------------------------------------------------------------------

function buildRequestBody(
  modelId: string,
  options: LanguageModelV3CallOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: modelId,
    messages: convertPrompt(options.prompt),
  };

  if (options.maxOutputTokens !== undefined) {
    body.max_tokens = options.maxOutputTokens;
  }
  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }
  if (options.topP !== undefined) {
    body.top_p = options.topP;
  }
  if (options.topK !== undefined) {
    body.top_k = options.topK;
  }
  if (options.presencePenalty !== undefined) {
    body.presence_penalty = options.presencePenalty;
  }
  if (options.frequencyPenalty !== undefined) {
    body.frequency_penalty = options.frequencyPenalty;
  }
  if (options.stopSequences !== undefined) {
    body.stop = options.stopSequences;
  }
  if (options.seed !== undefined) {
    body.seed = options.seed;
  }
  if (options.responseFormat) {
    if (options.responseFormat.type === "json") {
      body.response_format = options.responseFormat.schema
        ? {
            type: "json_schema",
            json_schema: {
              name: options.responseFormat.name ?? "response",
              schema: options.responseFormat.schema,
            },
          }
        : { type: "json_object" };
    }
  }

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools
      .filter(
        (t): t is Extract<(typeof options.tools)[number] & {}, { type: "function" }> =>
          t.type === "function",
      )
      .map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
  }

  if (options.toolChoice) {
    switch (options.toolChoice.type) {
      case "auto":
        body.tool_choice = "auto";
        break;
      case "none":
        body.tool_choice = "none";
        break;
      case "required":
        body.tool_choice = "required";
        break;
      case "tool":
        body.tool_choice = {
          type: "function",
          function: { name: options.toolChoice.toolName },
        };
        break;
    }
  }

  return body;
}

// ---------------------------------------------------------------------------
// Parse OpenAI response body into AI SDK GenerateResult
// ---------------------------------------------------------------------------

function parseResponse(
  responseBody: Record<string, unknown>,
): LanguageModelV3GenerateResult {
  const choices = responseBody.choices as
    | Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>
    | undefined;

  const choice = choices?.[0];
  const message = choice?.message;
  const rawFinishReason = choice?.finish_reason ?? "stop";

  const content: LanguageModelV3GenerateResult["content"] = [];

  if (message?.content) {
    content.push({ type: "text", text: message.content });
  }

  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      content.push({
        type: "tool-call",
        toolCallId: tc.id,
        toolName: tc.function.name,
        input: tc.function.arguments,
      });
    }
  }

  let unified: LanguageModelV3GenerateResult["finishReason"]["unified"];
  switch (rawFinishReason) {
    case "stop":
      unified = "stop";
      break;
    case "length":
      unified = "length";
      break;
    case "content_filter":
      unified = "content-filter";
      break;
    case "tool_calls":
    case "function_call":
      unified = "tool-calls";
      break;
    default:
      unified = "other";
  }

  const usage = responseBody.usage as
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      }
    | undefined;

  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const cachedTokens = usage?.prompt_tokens_details?.cached_tokens;
  const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens;

  return {
    content,
    finishReason: { unified, raw: rawFinishReason },
    usage: {
      inputTokens: {
        total: promptTokens,
        noCache: cachedTokens !== undefined ? promptTokens - cachedTokens : promptTokens,
        cacheRead: cachedTokens ?? undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: completionTokens,
        text: reasoningTokens !== undefined ? completionTokens - reasoningTokens : completionTokens,
        reasoning: reasoningTokens ?? undefined,
      },
    },
    warnings: [],
    response: {
      id: responseBody.id as string | undefined,
      modelId: responseBody.model as string | undefined,
      body: responseBody,
    },
  };
}

// ---------------------------------------------------------------------------
// BatchLanguageModel
// ---------------------------------------------------------------------------

class BatchLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]>;

  private readonly client: BatchOpenAI;

  constructor(inner: LanguageModelV3, client: BatchOpenAI) {
    this.provider = inner.provider;
    this.modelId = inner.modelId;
    this.supportedUrls = "then" in inner.supportedUrls ? {} : inner.supportedUrls;
    this.client = client;
  }

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> {
    const body = buildRequestBody(this.modelId, options);
    const response = await this.client.chat.completions.create(
      body as unknown as Parameters<typeof this.client.chat.completions.create>[0],
    );
    return parseResponse(response as unknown as Record<string, unknown>);
  }

  doStream(
    _options: LanguageModelV3CallOptions,
  ): PromiseLike<LanguageModelV3StreamResult> {
    throw new Error(
      "Streaming is not supported in batch mode. Use generateText() instead of streamText().",
    );
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Doubleword batch provider instance.
 *
 * Language model calls made through models created by this provider will be
 * queued and submitted as batch jobs via `autobatcher.BatchOpenAI` rather
 * than making individual inference calls.
 *
 * @example
 * ```ts
 * import { createDoublewordBatch } from "@doubleword/vercel-ai";
 * import { generateText } from "ai";
 *
 * const dw = createDoublewordBatch({ completionWindow: "1h" });
 * const results = await Promise.all(
 *   prompts.map((p) => generateText({ model: dw("your-model"), prompt: p }))
 * );
 * await dw.close();
 * ```
 */
export function createDoublewordBatch(
  options: DoublewordBatchProviderOptions = {},
): DoublewordBatchProvider {
  const baseURL = options.baseURL ?? resolveBaseURL();
  const apiKey = options.apiKey ?? resolveApiKey() ?? "";

  const client = new BatchOpenAI({
    apiKey,
    baseURL,
    batchSize: options.batchSize,
    batchWindowSeconds: options.batchWindowSeconds,
    pollIntervalSeconds: options.pollIntervalSeconds,
    completionWindow: options.completionWindow,
  });

  // Standard provider for model metadata and embedding passthrough.
  const standardProvider = createDoubleword({
    apiKey,
    baseURL,
    headers: options.headers,
  });

  const callable = function (modelId: string): LanguageModelV3 {
    return new BatchLanguageModel(standardProvider(modelId), client);
  };

  callable.languageModel = function (modelId: string): LanguageModelV3 {
    return new BatchLanguageModel(standardProvider.languageModel(modelId), client);
  };

  callable.chatModel = function (modelId: string): LanguageModelV3 {
    return new BatchLanguageModel(standardProvider.chatModel(modelId), client);
  };

  // Embeddings pass through directly.
  callable.embeddingModel = standardProvider.embeddingModel.bind(standardProvider);
  callable.textEmbeddingModel = standardProvider.textEmbeddingModel.bind(standardProvider);

  callable.close = async function (): Promise<void> {
    await client.close();
  };

  return callable as DoublewordBatchProvider;
}
