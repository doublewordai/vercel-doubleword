# Prompt caching

Reuse a repeated prompt prefix on Doubleword so later requests read the stored
work instead of recomputing it (cheaper, no redundant compute). This example
runs one large, stable system prompt twice and shows the cache filling then
being read.

## Run

```bash
export DOUBLEWORD_API_KEY=sk-...
npm install
npm start
```

Expected output (the warm call reads the cached prefix):

```
cold  cache_read=0     fresh=~4100  ->  ...
warm  cache_read=~4100 fresh=~15    ->  ...
```

## How it works

`createDoubleword({ cacheControl: { type: "ephemeral", ttl: "1h" } })` adds a
`cache_control` marker to the last system message and the latest message of
each request. `ttl` is `"5m"` or `"1h"`. It is optional and the API default is
`"5m"`. Cache reads show up on `usage.inputTokenDetails.cacheReadTokens`.

Override the marker for one call with the same object, or pass `false` to skip
caching:

```ts
await generateText({
  model,
  system: SYSTEM,
  prompt,
  providerOptions: { doubleword: { cacheControl: { type: "ephemeral" } } },
});
```
