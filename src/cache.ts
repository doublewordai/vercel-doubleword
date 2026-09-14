// Adds cache_control to the last system message and the latest message of a chat request body.
// See https://docs.doubleword.ai/inference-api/prompt-caching

export type CacheControl = { type: "ephemeral"; ttl?: "5m" | "1h" };

const MAX_BREAKPOINTS = 4;

type Part = { type?: string; text?: unknown; cache_control?: unknown };
type Message = { role?: string; content?: unknown; cache_control?: unknown };

function countMarkers(message: Message): number {
  const parts = Array.isArray(message.content) ? (message.content as Part[]) : [];
  const onParts = parts.filter((part) => part?.cache_control != null).length;
  return onParts + (message.cache_control != null ? 1 : 0);
}

function mark(message: Message, cacheControl: CacheControl): boolean {
  if (typeof message.content === "string") {
    if (!message.content) return false;
    message.content = [{ type: "text", text: message.content, cache_control: { ...cacheControl } }];
    return true;
  }
  if (!Array.isArray(message.content)) return false;
  for (let i = message.content.length - 1; i >= 0; i--) {
    const part = message.content[i] as Part | null;
    if (part?.type === "text" && part.text) {
      part.cache_control = { ...cacheControl };
      return true;
    }
  }
  return false;
}

export function applyCacheControl<T extends { messages?: unknown }>(
  body: T,
  cacheControl: CacheControl | false | undefined,
): T {
  const messages = body.messages as Message[] | undefined;
  if (!cacheControl || !Array.isArray(messages) || messages.length === 0) return body;
  let count = 0;
  let system = -1;
  messages.forEach((message, i) => {
    count += countMarkers(message);
    if (message.role === "system") system = i;
  });
  for (const i of new Set([system, messages.length - 1])) {
    if (count >= MAX_BREAKPOINTS) break;
    if (i >= 0 && countMarkers(messages[i]) === 0 && mark(messages[i], cacheControl)) count++;
  }
  return body;
}
