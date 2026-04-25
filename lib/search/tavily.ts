// Tavily search API client.
// Used by:
//   - Generator's `search_catalog` tool to find catalog numbers + product pages
//   - Verifier agent to live-check that catalog numbers actually exist
//   - `search_suppliers` to compare prices across suppliers
//
// Docs: https://docs.tavily.com/
// Cost: covered by user's redeem code (not a concern for this hackathon).

const BASE = "https://api.tavily.com";

export interface TavilySearchOptions {
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  searchDepth?: "basic" | "advanced";
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

const SUPPLIER_DOMAINS = [
  "sigmaaldrich.com",
  "thermofisher.com",
  "promega.com",
  "qiagen.com",
  "idtdna.com",
  "atcc.org",
  "addgene.org",
  "abcam.com",
  "ncbi.nlm.nih.gov",
  "protocols.io",
  "bio-protocol.org",
  "nature.com",
];

export async function tavilySearch(
  query: string,
  options: TavilySearchOptions = {}
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY not set");
  }
  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: options.searchDepth ?? "advanced",
      max_results: options.maxResults ?? 5,
      include_domains: options.includeDomains,
      exclude_domains: options.excludeDomains,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { results?: TavilyResult[] };
  return json.results ?? [];
}

/**
 * Catalog-number search restricted to known supplier domains. Returns the
 * top hit (typically a product page) so the Generator can extract the
 * catalog number from the URL or content.
 */
export async function tavilyCatalogSearch(
  reagent: string
): Promise<TavilyResult | null> {
  const results = await tavilySearch(`${reagent} catalog number product`, {
    maxResults: 3,
    includeDomains: SUPPLIER_DOMAINS,
    searchDepth: "advanced",
  });
  return results[0] ?? null;
}
