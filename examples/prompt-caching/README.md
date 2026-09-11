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
cold  cache_read=0     fresh=~2000  ->  ...
warm  cache_read=~2000 fresh=~20    ->  ...
```

## How it works

`createDoubleword({ cache: { ttl: "1h" } })` marks the system prefix with
`cache_control`. The cache is left-anchored with a ~1024-token floor, and `ttl`
is `"5m"` or `"1h"`. Cache activity is reported on `usage.inputTokenDetails`
(`cacheReadTokens`, `noCacheTokens`).

To cache a different message or tune a single call, use the explicit form:

```ts
await generateText({
  model,
  system: SYSTEM,
  prompt,
  providerOptions: {
    doubleword: { cacheControl: { ttl: "1h", scope: "system" } },
  },
});
```

`scope` is `"system"` (default), `"lastUser"`, or an array of message indices.
Pass `cacheControl: false` to skip caching for one call.
