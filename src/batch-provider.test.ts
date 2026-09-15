import assert from "node:assert/strict";
import { test } from "node:test";
import { createDoublewordAsync, createDoublewordBatch } from "./batch-provider.js";

const OPTIONS = { apiKey: "test", baseURL: "http://localhost" };

const windowOf = (provider: ReturnType<typeof createDoublewordBatch>) =>
  (provider("m") as unknown as { client: { _completionWindow: string } }).client._completionWindow;

test("createDoublewordAsync defaults to the 1h window", async () => {
  const provider = createDoublewordAsync(OPTIONS);
  assert.equal(windowOf(provider), "1h");
  await provider.close();
});

test("createDoublewordBatch defaults to the 24h window", async () => {
  const provider = createDoublewordBatch(OPTIONS);
  assert.equal(windowOf(provider), "24h");
  await provider.close();
});

test("an explicit completionWindow overrides the default", async () => {
  const provider = createDoublewordAsync({ ...OPTIONS, completionWindow: "24h" });
  assert.equal(windowOf(provider), "24h");
  await provider.close();
});
