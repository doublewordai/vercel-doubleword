/**
 * Web search (Serper) and page reader (Jina) wrappers.
 *
 * These are thin HTTP wrappers — no LLM logic lives here.
 */

// ---------------------------------------------------------------------------
// Serper search
// ---------------------------------------------------------------------------

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export async function search(
  query: string,
  maxResults: number = 10,
): Promise<SearchResponse> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY environment variable not set");

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });
  if (!res.ok) throw new Error(`Serper API error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const results: SearchResult[] = (data.organic ?? []).map(
    (item: Record<string, string>) => ({
      url: item.link ?? "",
      title: item.title ?? "",
      snippet: item.snippet ?? "",
    }),
  );
  return { results };
}

// ---------------------------------------------------------------------------
// Jina Reader (URL -> markdown)
// ---------------------------------------------------------------------------

export async function fetchUrl(url: string, timeout = 15_000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 50_000); // limit to 50k chars
  } catch {
    return null;
  }
}

export async function fetchUrls(
  urls: string[],
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    urls.map(async (url) => [url, await fetchUrl(url)] as const),
  );
  return Object.fromEntries(entries);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatResultsForContext(
  query: string,
  results: SearchResponse,
): string {
  const items = results.results;
  if (items.length === 0) return `Search for "${query}" returned no results.`;

  const lines = [`Search results for "${query}":\n`];
  for (let i = 0; i < items.length; i++) {
    const { title, url, snippet } = items[i];
    lines.push(`${i + 1}. [${title || "Untitled"}](${url})`);
    if (snippet) lines.push(`   ${snippet}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function extractUrls(results: SearchResponse): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const r of results.results) {
    if (r.url && !seen.has(r.url)) {
      seen.add(r.url);
      urls.push(r.url);
    }
  }
  return urls;
}
