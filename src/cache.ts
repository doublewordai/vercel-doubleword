// Adds cache_control to the last system message and the latest message of a chat request body.
// See https://docs.doubleword.ai/inference-api/prompt-caching

export type CacheControl = { type: "ephemeral"; ttl?: "5m" | "1h" };

const MAX_BREAKPOINTS = 4;

type Part = { type?: string; text?: unknown; cache_control?: unknown };
type Message = { role?: string; content?: unknown };

const isMarked = (item: unknown) => (item as { cache_control?: unknown } | null)?.cache_control != null;

function countMarkers(message: Message): number {
  return Array.isArray(message.content) ? message.content.filter(isMarked).length : 0;
}

function mark(message: Message, cacheControl: CacheControl): Message | undefined {
  const { content } = message;
  if (typeof content === "string") {
    if (!content) return undefined;
    const part = { type: "text", text: content, cache_control: { ...cacheControl } };
    return { ...message, content: [part] };
  }
  if (!Array.isArray(content)) return undefined;
  for (let i = content.length - 1; i >= 0; i--) {
    const part = content[i] as Part | null;
    if (part?.type === "text" && part.text) {
      const parts = [...content];
      parts[i] = { ...part, cache_control: { ...cacheControl } };
      return { ...message, content: parts };
    }
  }
  return undefined;
}

export function applyCacheControl<T extends { messages?: unknown; tools?: unknown }>(
  body: T,
  cacheControl: CacheControl | false | undefined,
): T {
  if (!cacheControl || !Array.isArray(body.messages) || body.messages.length === 0) return body;
  const messages: Message[] = [...body.messages];
  let count = Array.isArray(body.tools) ? body.tools.filter(isMarked).length : 0;
  let system = -1;
  messages.forEach((message, i) => {
    count += countMarkers(message);
    if (message.role === "system") system = i;
  });
  for (const i of new Set([system, messages.length - 1])) {
    if (count >= MAX_BREAKPOINTS) break;
    const marked = i >= 0 && countMarkers(messages[i]) === 0 ? mark(messages[i], cacheControl) : undefined;
    if (marked) {
      messages[i] = marked;
      count++;
    }
  }
  return { ...body, messages };
}
