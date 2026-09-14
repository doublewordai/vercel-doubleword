import assert from "node:assert/strict";
import { test } from "node:test";
import type { LanguageModelV3CallOptions } from "@ai-sdk/provider";
import { createDoublewordAsync } from "./batch-provider.js";
import { applyCacheControl, type CacheControl } from "./cache.js";
import { createDoubleword } from "./doubleword-provider.js";

const EPHEMERAL: CacheControl = { type: "ephemeral" };
const ONE_HOUR: CacheControl = { type: "ephemeral", ttl: "1h" };

const text = (value: string, cache_control?: CacheControl) =>
  cache_control ? { type: "text", text: value, cache_control } : { type: "text", text: value };

test("marks the last system message and the latest message", () => {
  const body = {
    messages: [
      { role: "system", content: "intro" },
      { role: "system", content: "stable instructions" },
      { role: "user", content: "question" },
      { role: "assistant", content: "answer" },
      { role: "user", content: "follow-up" },
    ],
  };
  applyCacheControl(body, EPHEMERAL);
  assert.deepEqual(body.messages, [
    { role: "system", content: "intro" },
    { role: "system", content: [text("stable instructions", EPHEMERAL)] },
    { role: "user", content: "question" },
    { role: "assistant", content: "answer" },
    { role: "user", content: [text("follow-up", EPHEMERAL)] },
  ]);
});

test("marks once when the system message is also the latest message", () => {
  const body = { messages: [{ role: "system", content: "only message" }] };
  applyCacheControl(body, EPHEMERAL);
  assert.deepEqual(body.messages, [
    { role: "system", content: [text("only message", EPHEMERAL)] },
  ]);
});

test("marks only the latest message when there is no system message", () => {
  const body = {
    messages: [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "tool", tool_call_id: "call_1", content: "42" },
    ],
  };
  applyCacheControl(body, EPHEMERAL);
  assert.deepEqual(body.messages, [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "tool", tool_call_id: "call_1", content: [text("42", EPHEMERAL)] },
  ]);
});

test("sends no ttl key when ttl is omitted", () => {
  const body = { messages: [{ role: "user", content: "hi" }] };
  applyCacheControl(body, { type: "ephemeral" });
  assert.equal(
    JSON.stringify(body.messages[0].content),
    '[{"type":"text","text":"hi","cache_control":{"type":"ephemeral"}}]',
  );
});

test("passes ttl through", () => {
  for (const ttl of ["5m", "1h"] as const) {
    const body = { messages: [{ role: "user", content: "hi" }] };
    applyCacheControl(body, { type: "ephemeral", ttl });
    assert.deepEqual(body.messages[0].content, [text("hi", { type: "ephemeral", ttl })]);
  }
});

test("marks the last text part and skips a target with no text", () => {
  const image = { type: "image_url", image_url: { url: "https://example.com/a.png" } };
  const body = {
    messages: [
      { role: "system", content: [text("a"), text("b"), image] },
      { role: "user", content: [image] },
    ],
  };
  applyCacheControl(body, EPHEMERAL);
  assert.deepEqual(body.messages, [
    { role: "system", content: [text("a"), text("b", EPHEMERAL), image] },
    { role: "user", content: [image] },
  ]);

  const toolCallOnly = { messages: [{ role: "assistant", content: "" }] };
  applyCacheControl(toolCallOnly, EPHEMERAL);
  assert.deepEqual(toolCallOnly.messages, [{ role: "assistant", content: "" }]);
});

test("leaves messages that already carry a marker untouched", () => {
  const body = {
    messages: [
      { role: "system", content: [text("a", ONE_HOUR), text("b")] },
      { role: "user", content: "question" },
    ],
  };
  applyCacheControl(body, EPHEMERAL);
  assert.deepEqual(body.messages, [
    { role: "system", content: [text("a", ONE_HOUR), text("b")] },
    { role: "user", content: [text("question", EPHEMERAL)] },
  ]);

  const messageLevel = { messages: [{ role: "user", content: "hi", cache_control: ONE_HOUR }] };
  applyCacheControl(messageLevel, EPHEMERAL);
  assert.deepEqual(messageLevel.messages, [{ role: "user", content: "hi", cache_control: ONE_HOUR }]);
});

test("never exceeds 4 breakpoints and adds the system marker first", () => {
  const marked = (value: string) => ({ role: "user", content: [text(value, ONE_HOUR)] });

  const threeMarked = {
    messages: [
      { role: "system", content: "system" },
      marked("1"),
      marked("2"),
      marked("3"),
      { role: "user", content: "latest" },
    ],
  };
  applyCacheControl(threeMarked, EPHEMERAL);
  assert.deepEqual(threeMarked.messages[0].content, [text("system", EPHEMERAL)]);
  assert.equal(threeMarked.messages[4].content, "latest");

  const fourMarked = {
    messages: [
      { role: "system", content: "system" },
      marked("1"),
      marked("2"),
      marked("3"),
      marked("4"),
      { role: "user", content: "latest" },
    ],
  };
  applyCacheControl(fourMarked, EPHEMERAL);
  assert.equal(fourMarked.messages[0].content, "system");
  assert.equal(fourMarked.messages[5].content, "latest");
});

test("does nothing when caching is off", () => {
  for (const cacheControl of [undefined, false] as const) {
    const body = { messages: [{ role: "system", content: "x" }, { role: "user", content: "y" }] };
    applyCacheControl(body, cacheControl);
    assert.deepEqual(body.messages, [
      { role: "system", content: "x" },
      { role: "user", content: "y" },
    ]);
  }
});

const PROMPT: LanguageModelV3CallOptions["prompt"] = [
  { role: "system", content: "stable instructions" },
  { role: "user", content: [{ type: "text", text: "question" }] },
];

const UNMARKED = [
  { role: "system", content: "stable instructions" },
  { role: "user", content: "question" },
];

const markedWith = (cacheControl: CacheControl) => [
  { role: "system", content: [text("stable instructions", cacheControl)] },
  { role: "user", content: [text("question", cacheControl)] },
];

async function sendWithDoubleword(
  cacheControl: CacheControl | undefined,
  providerOptions?: LanguageModelV3CallOptions["providerOptions"],
): Promise<Record<string, unknown>> {
  const realFetch = globalThis.fetch;
  let sent: Record<string, unknown> = {};
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    const completion = {
      id: "1",
      created: 0,
      model: "m",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    };
    return new Response(JSON.stringify(completion), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const doubleword = createDoubleword({ apiKey: "test", baseURL: "http://localhost", cacheControl });
    await doubleword("m").doGenerate({ prompt: PROMPT, providerOptions });
  } finally {
    globalThis.fetch = realFetch;
  }
  return sent;
}

test("createDoubleword applies the provider-level cacheControl", async () => {
  const body = await sendWithDoubleword(ONE_HOUR);
  assert.deepEqual(body.messages, markedWith(ONE_HOUR));
  assert.equal("cacheControl" in body, false);
  assert.equal("cache_control" in body, false);
});

test("a per-call cacheControl object replaces the provider-level one", async () => {
  const body = await sendWithDoubleword(ONE_HOUR, {
    doubleword: { cacheControl: { type: "ephemeral" } },
  });
  assert.deepEqual(body.messages, markedWith(EPHEMERAL));
  assert.equal("cacheControl" in body, false);
  assert.equal("cache_control" in body, false);
});

test("a per-call cacheControl of false skips caching", async () => {
  const body = await sendWithDoubleword(ONE_HOUR, { doubleword: { cacheControl: false } });
  assert.deepEqual(body.messages, UNMARKED);
  assert.equal("cacheControl" in body, false);
  assert.equal("cache_control" in body, false);
});

test("createDoublewordAsync applies cacheControl and the per-call override", async () => {
  const doubleword = createDoublewordAsync({
    apiKey: "test",
    baseURL: "http://localhost",
    cacheControl: ONE_HOUR,
  });
  const model = doubleword("m");
  const sent: Array<Record<string, unknown>> = [];
  const create = async (body: Record<string, unknown>) => {
    sent.push(body);
    return { choices: [{ message: { content: "ok" }, finish_reason: "stop" }] };
  };
  (model as unknown as { client: unknown }).client = { chat: { completions: { create } } };

  await model.doGenerate({ prompt: PROMPT });
  await model.doGenerate({
    prompt: PROMPT,
    providerOptions: { doubleword: { cacheControl: { type: "ephemeral" } } },
  });
  await model.doGenerate({ prompt: PROMPT, providerOptions: { doubleword: { cacheControl: false } } });
  await doubleword.close();

  assert.deepEqual(
    sent.map((body) => body.messages),
    [markedWith(ONE_HOUR), markedWith(EPHEMERAL), UNMARKED],
  );
  for (const body of sent) {
    assert.equal("cacheControl" in body, false);
    assert.equal("cache_control" in body, false);
  }
});
