// Semantic Scholar API client.
// Free, keyless. Rate limit ~100 req/min unshared.
// Docs: https://api.semanticscholar.org/api-docs/
//
// Used by the Lit QC agent to find similar published work given a
// natural-language hypothesis.

import type { Reference } from "@/lib/types";

const BASE = "https://api.semanticscholar.org/graph/v1";

export interface SemanticScholarSearchOptions {
  limit?: number;
  fields?: string[];
}

const DEFAULT_FIELDS = [
  "paperId",
  "title",
  "authors.name",
  "year",
  "externalIds",
  "citationCount",
  "openAccessPdf",
];

export async function searchSemanticScholar(
  query: string,
  options: SemanticScholarSearchOptions = {}
): Promise<Reference[]> {
  const fields = (options.fields ?? DEFAULT_FIELDS).join(",");
  const limit = options.limit ?? 5;
  const url = `${BASE}/paper/search?query=${encodeURIComponent(
    query
  )}&limit=${limit}&fields=${fields}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Cache search results for 5 min — reduces flakiness on retries.
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Semantic Scholar ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data?: Array<{
      paperId: string;
      title: string;
      authors?: { name: string }[];
      year?: number;
      externalIds?: { DOI?: string };
      openAccessPdf?: { url?: string };
    }>;
  };
  return (data.data ?? []).map((p) => ({
    title: p.title,
    authors: (p.authors ?? []).map((a) => a.name),
    year: p.year,
    source: "semantic_scholar" as const,
    doi: p.externalIds?.DOI,
    url: p.openAccessPdf?.url,
  }));
}
