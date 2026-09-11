/**
 * Prompt caching for @doubleword/vercel-ai.
 *
 * Doubleword serves Anthropic-style prompt caching over its OpenAI-compatible
 * `/chat/completions` endpoint: mark a message content block with
 * `cache_control` and everything up to that mark becomes a reusable prefix
 * (left-anchored, ~1024-token floor, ttl `5m` or `1h`). The base
 * `@ai-sdk/openai-compatible` provider never emits `cache_control`, so this
 * module rewrites the outgoing request body to attach it, driven either by a
 * provider-level default (`createDoubleword({ cache })`) or per request
 * (`providerOptions.doubleword.cacheControl`).
 *
 * Everything here is a pure transform over the already-assembled request body,
 * so it is unit-testable without the network or the SDK.
 */

export type CacheTTL = "5m" | "1h";

/**
 * Which messages carry the cache breakpoint.
 *
 * - `"system"` (default): the last system message, caching the system prefix.
 * - `"lastUser"`: the last user message.
 * - `number[]`: exact message indices, for full control.
 */
export type CacheScope = "system" | "lastUser" | number[];

export interface CacheConfig {
  /** Cache lifetime. Defaults to `"1h"`. */
  ttl?: CacheTTL;
  /** Which messages to mark. Defaults to `"system"`. */
  scope?: CacheScope;
}

/** Provider- or request-level cache option: `true` uses the defaults. */
export type CacheOption = boolean | CacheConfig;

interface ResolvedCacheConfig {
  ttl: CacheTTL;
  scope: CacheScope;
}

/**
 * Normalize a cache option into a concrete config, or `null` when disabled.
 */
export function normalizeCacheConfig(
  option: CacheOption | null | undefined,
): ResolvedCacheConfig | null {
  if (option === undefined || option === null || option === false) return null;
  if (option === true) return { ttl: "1h", scope: "system" };
  return { ttl: option.ttl ?? "1h", scope: option.scope ?? "system" };
}

type WireMessage = { role?: string; content?: unknown };

function resolveTargets(messages: WireMessage[], scope: CacheScope): number[] {
  if (Array.isArray(scope)) {
    return scope.filter((i) => Number.isInteger(i) && i >= 0 && i < messages.length);
  }
  if (scope === "lastUser") {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") return [i];
    }
    return [];
  }
  // "system": the last system message.
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "system") return [i];
  }
  return [];
}

/**
 * Attach `cache_control` to one message, converting string content to the
 * block form the endpoint expects. A no-op if the message has no text to mark.
 */
function markMessage(message: WireMessage, ttl: CacheTTL): void {
  const cacheControl = { type: "ephemeral", ttl };
  const content = message.content;
  if (typeof content === "string") {
    message.content = [{ type: "text", text: content, cache_control: cacheControl }];
    return;
  }
  if (Array.isArray(content)) {
    for (let i = content.length - 1; i >= 0; i--) {
      const part = content[i] as { type?: string; cache_control?: unknown } | null;
      if (part && part.type === "text") {
        part.cache_control = cacheControl;
        return;
      }
    }
  }
}

/**
 * Apply `cache_control` to the request body in place and return it. Safe to
 * call with a `null` config (returns the body untouched).
 */
export function applyCacheControl<T extends { messages?: unknown }>(
  body: T,
  config: ResolvedCacheConfig | null,
): T {
  if (!config) return body;
  const messages = body.messages;
  if (!Array.isArray(messages)) return body;
  for (const index of resolveTargets(messages as WireMessage[], config.scope)) {
    markMessage((messages as WireMessage[])[index], config.ttl);
  }
  return body;
}
