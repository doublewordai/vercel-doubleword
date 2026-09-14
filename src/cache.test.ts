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

const apply = (
  body: { messages: unknown[]; tools?: unknown[] },
  cacheControl: CacheControl | false | undefined = EPHEMERAL,
) => applyCacheControl(body, cacheControl).messages;

test("marks the last system message and the latest message", () => {
  const messages = apply({
    messages: [
      { role: "system", content: "intro" },
      { role: "system", content: "stable instructions" },
      { role: "user", content: "question" },
      { role: "assistant", content: "answer" },
      { role: "user", content: "follow-up" },
    ],
  });
  assert.deepEqual(messages, [
    { role: "system", content: "intro" },
    { role: "system", content: [text("stable instructions", EPHEMERAL)] },
    { role: "user", content: "question" },
    { role: "assistant", content: "answer" },
    { role: "user", content: [text("follow-up", EPHEMERAL)] },
  ]);
});

test("marks once when the system message is also the latest message", () => {
  assert.deepEqual(apply({ messages: [{ role: "system", content: "only message" }] }), [
    { role: "system", content: [text("only message", EPHEMERAL)] },
  ]);
});

test("marks only the latest message when there is no system message", () => {
  const messages = apply({
    messages: [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "tool", tool_call_id: "call_1", content: "42" },
    ],
  });
  assert.deepEqual(messages, [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "tool", tool_call_id: "call_1", content: [text("42", EPHEMERAL)] },
  ]);
});

test("sends no ttl key when ttl is omitted", () => {
  const messages = apply({ messages: [{ role: "user", content: "hi" }] }, { type: "ephemeral" });
  assert.equal(
    JSON.stringify(messages),
    '[{"role":"user","content":[{"type":"text","text":"hi","cache_control":{"type":"ephemeral"}}]}]',
  );
});

test("passes ttl through", () => {
  for (const ttl of ["5m", "1h"] as const) {
    const messages = apply({ messages: [{ role: "user", content: "hi" }] }, { type: "ephemeral", ttl });
    assert.deepEqual(messages, [{ role: "user", content: [text("hi", { type: "ephemeral", ttl })] }]);
  }
});

test("marks the last text part and skips a target with no text", () => {
  const image = { type: "image_url", image_url: { url: "https://example.com/a.png" } };
  const messages = apply({
    messages: [
      { role: "system", content: [text("a"), text("b"), image] },
      { role: "user", content: [image] },
    ],
  });
  assert.deepEqual(messages, [
    { role: "system", content: [text("a"), text("b", EPHEMERAL), image] },
    { role: "user", content: [image] },
  ]);
  assert.deepEqual(apply({ messages: [{ role: "assistant", content: "" }] }), [
    { role: "assistant", content: "" },
  ]);
});

test("leaves messages that already carry a marker untouched", () => {
  const messages = apply({
    messages: [
      { role: "system", content: [text("a", ONE_HOUR), text("b")] },
      { role: "user", content: "question" },
    ],
  });
  assert.deepEqual(messages, [
    { role: "system", content: [text("a", ONE_HOUR), text("b")] },
    { role: "user", content: [text("question", EPHEMERAL)] },
  ]);
});

test("never exceeds 4 breakpoints across tools and messages", () => {
  const marked = (value: string) => ({ role: "user", content: [text(value, ONE_HOUR)] });
  const tool = (name: string) => ({ type: "function", function: { name }, cache_control: ONE_HOUR });
  const system = { role: "system", content: "system" };
  const markedSystem = { role: "system", content: [text("system", EPHEMERAL)] };
  const latest = { role: "user", content: "latest" };

  assert.deepEqual(apply({ messages: [system, marked("1"), marked("2"), marked("3"), latest] }), [
    markedSystem,
    marked("1"),
    marked("2"),
    marked("3"),
    latest,
  ]);
  assert.deepEqual(apply({ tools: [tool("a"), tool("b")], messages: [system, marked("1"), latest] }), [
    markedSystem,
    marked("1"),
    latest,
  ]);
  const full = [system, marked("1"), latest];
  assert.deepEqual(apply({ tools: [tool("a"), tool("b"), tool("c")], messages: full }), full);
});

test("does nothing when caching is off", () => {
  const messages = [
    { role: "system", content: "x" },
    { role: "user", content: "y" },
  ];
  assert.deepEqual(applyCacheControl({ messages }, undefined).messages, messages);
  assert.deepEqual(applyCacheControl({ messages }, false).messages, messages);
});

test("does not mutate the input body", () => {
  const body = {
    messages: [
      { role: "system", content: "stable instructions" },
      { role: "user", content: [text("context"), text("question")] },
    ],
  };
  const before = structuredClone(body);
  const first = applyCacheControl(body, EPHEMERAL);
  const second = applyCacheControl(body, EPHEMERAL);
  assert.deepEqual(body, before);
  assert.deepEqual(second, first);
  assert.deepEqual(first.messages, [
    { role: "system", content: [text("stable instructions", EPHEMERAL)] },
    { role: "user", content: [text("context"), text("question", EPHEMERAL)] },
  ]);
});

type Call = Pick<LanguageModelV3CallOptions, "prompt" | "providerOptions">;

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

const COMPLETION = {
  id: "1",
  created: 0,
  model: "m",
  choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

async function sendWithDoubleword(
  cacheControl: CacheControl | undefined,
  calls: Call[],
): Promise<Array<Record<string, unknown>>> {
  const realFetch = globalThis.fetch;
  const sent: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(COMPLETION), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const model = createDoubleword({ apiKey: "test", baseURL: "http://localhost", cacheControl })("m");
    for (const call of calls) await model.doGenerate(call);
  } finally {
    globalThis.fetch = realFetch;
  }
  return sent;
}

function assertNoTopLevelCacheControl(bodies: Array<Record<string, unknown>>): void {
  for (const body of bodies) {
    assert.equal("cacheControl" in body, false);
    assert.equal("cache_control" in body, false);
  }
}

test("createDoubleword applies the provider-level cacheControl", async () => {
  const sent = await sendWithDoubleword(ONE_HOUR, [{ prompt: PROMPT }]);
  assert.deepEqual(sent[0].messages, markedWith(ONE_HOUR));
  assertNoTopLevelCacheControl(sent);
});

test("a per-call cacheControl object replaces the provider-level one", async () => {
  const sent = await sendWithDoubleword(ONE_HOUR, [
    { prompt: PROMPT, providerOptions: { doubleword: { cacheControl: { type: "ephemeral" } } } },
  ]);
  assert.deepEqual(sent[0].messages, markedWith(EPHEMERAL));
  assertNoTopLevelCacheControl(sent);
});

test("a per-call cacheControl of false skips caching", async () => {
  const sent = await sendWithDoubleword(ONE_HOUR, [
    { prompt: PROMPT, providerOptions: { doubleword: { cacheControl: false } } },
  ]);
  assert.deepEqual(sent[0].messages, UNMARKED);
  assertNoTopLevelCacheControl(sent);
});

test("createDoubleword leaves the caller's prompt unchanged across calls", async () => {
  const prompt: LanguageModelV3CallOptions["prompt"] = [
    { role: "system", content: "stable instructions" },
    {
      role: "user",
      content: [
        { type: "text", text: "context" },
        { type: "text", text: "question" },
      ],
    },
  ];
  const before = structuredClone(prompt);
  const sent = await sendWithDoubleword(EPHEMERAL, [{ prompt }, { prompt }]);
  assert.deepEqual(prompt, before);
  const expected = [
    { role: "system", content: [text("stable instructions", EPHEMERAL)] },
    { role: "user", content: [text("context"), text("question", EPHEMERAL)] },
  ];
  assert.deepEqual(sent[0].messages, expected);
  assert.deepEqual(sent[1].messages, expected);
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
    sent.push(structuredClone(body));
    return { choices: [{ message: { content: "ok" }, finish_reason: "stop" }] };
  };
  (model as unknown as { client: unknown }).client = { chat: { completions: { create } } };
  const before = structuredClone(PROMPT);

  await model.doGenerate({ prompt: PROMPT });
  await model.doGenerate({
    prompt: PROMPT,
    providerOptions: { doubleword: { cacheControl: { type: "ephemeral" } } },
  });
  await model.doGenerate({ prompt: PROMPT, providerOptions: { doubleword: { cacheControl: false } } });
  await doubleword.close();

  assert.deepEqual(PROMPT, before);
  assert.deepEqual(
    sent.map((body) => body.messages),
    [markedWith(ONE_HOUR), markedWith(EPHEMERAL), UNMARKED],
  );
  assertNoTopLevelCacheControl(sent);
});
