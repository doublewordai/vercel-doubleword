import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCacheControl, normalizeCacheConfig } from "./cache.js";

test("normalizeCacheConfig maps options to a concrete config or null", () => {
  assert.equal(normalizeCacheConfig(undefined), null);
  assert.equal(normalizeCacheConfig(false), null);
  assert.deepEqual(normalizeCacheConfig(true), { ttl: "1h", scope: "system" });
  assert.deepEqual(normalizeCacheConfig({ ttl: "5m" }), { ttl: "5m", scope: "system" });
  assert.deepEqual(normalizeCacheConfig({ scope: "lastUser" }), {
    ttl: "1h",
    scope: "lastUser",
  });
});

test("automatic system scope marks the last system message, string -> block", () => {
  const body = {
    messages: [
      { role: "system", content: "big stable prompt" },
      { role: "user", content: "hi" },
    ],
  };
  applyCacheControl(body, normalizeCacheConfig(true));
  assert.deepEqual(body.messages[0].content, [
    { type: "text", text: "big stable prompt", cache_control: { type: "ephemeral", ttl: "1h" } },
  ]);
  // The user message is untouched.
  assert.equal(body.messages[1].content, "hi");
});

test("lastUser scope marks the final user message with the chosen ttl", () => {
  const body = {
    messages: [
      { role: "user", content: "first" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "second" },
    ],
  };
  applyCacheControl(body, normalizeCacheConfig({ ttl: "5m", scope: "lastUser" }));
  assert.deepEqual(body.messages[2].content, [
    { type: "text", text: "second", cache_control: { type: "ephemeral", ttl: "5m" } },
  ]);
  assert.equal(body.messages[0].content, "first");
});

test("array content gets cache_control on its last text part", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "a" },
          { type: "text", text: "b" },
        ],
      },
    ],
  };
  applyCacheControl(body, normalizeCacheConfig({ scope: [0] }));
  assert.equal((body.messages[0].content[0] as Record<string, unknown>).cache_control, undefined);
  assert.deepEqual((body.messages[0].content[1] as Record<string, unknown>).cache_control, {
    type: "ephemeral",
    ttl: "1h",
  });
});

test("disabled config and absent messages are no-ops", () => {
  const body = { messages: [{ role: "system", content: "x" }] };
  applyCacheControl(body, null);
  assert.equal(body.messages[0].content, "x");
  const noMessages = { model: "m" } as { model: string; messages?: unknown };
  assert.deepEqual(applyCacheControl(noMessages, normalizeCacheConfig(true)), { model: "m" });
});
