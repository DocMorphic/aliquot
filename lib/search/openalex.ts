// OpenAlex API client.
// Free, keyless, unlimited public access (10 req/s, 100k/day per IP).
// Docs: https://docs.openalex.org/
//
// Best primary literature source for biology/chemistry/climate hypotheses
// since Semantic Scholar's free tier rate-limits aggressively without an
// API key, and arXiv is mostly physics/CS.

import type { Reference } from "@/lib/types";

const BASE = "https://api.openalex.org/works";

// Polite pool — OpenAlex prioritizes requests with a contact email.
// Doesn't gate access; just gives us better priority.
const POLITE_EMAIL = process.env.OPENALEX_EMAIL || "aliquot@example.com";

export async function searchOpenAlex(query: string, limit = 5): Promise<Reference[]> {
  const url = `${BASE}?search=${encodeURIComponent(query)}&per_page=${limit}&mailto=${encodeURIComponent(POLITE_EMAIL)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
  const json = (await res.json()) as {
    results?: Array<{
      id: string;
      title: string;
      doi?: string;
      publication_year?: number;
      authorships?: Array<{ author: { display_name: string } }>;
      open_access?: { oa_url?: string };
      best_oa_location?: { source?: { display_name?: string } };
    }>;
  };
  return (json.results ?? []).map((w) => ({
    title: w.title ?? "(untitled)",
    authors: (w.authorships ?? []).map((a) => a.author.display_name),
    year: w.publication_year,
    source: "semantic_scholar" as const, // alias under existing source enum until we extend the type
    doi: w.doi?.replace(/^https?:\/\/doi\.org\//, ""),
    url: w.open_access?.oa_url,
  }));
}
