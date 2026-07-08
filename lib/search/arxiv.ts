// arXiv API client (Atom XML feed).
// Free, keyless. https://info.arxiv.org/help/api/index.html
// Used by Lit QC to surface preprints that Semantic Scholar may have missed.

import type { Reference } from "@/lib/types";

const BASE = "https://export.arxiv.org/api/query";

export async function searchArxiv(query: string, limit = 5): Promise<Reference[]> {
  const url = `${BASE}?search_query=${encodeURIComponent("all:" + query)}&max_results=${limit}&sortBy=relevance`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  const xml = await res.text();
  return parseArxivAtom(xml);
}

/**
 * Tiny Atom-XML parser for arXiv responses. Avoids pulling in a full XML
 * library — just regex-extract the few fields we need. Brittle but fine
 * for now; replace with `fast-xml-parser` if results stop parsing.
 */
function parseArxivAtom(xml: string): Reference[] {
  const entries = xml.split(/<entry>/).slice(1);
  return entries.map((entry) => {
    const title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const linkUrl = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1] ?? "";
    const yearMatch = entry.match(/<published>(\d{4})/);
    const authors: string[] = [];
    // Match all <name>...</name> author entries.
    const authorMatches = entry.matchAll(/<name>([^<]+)<\/name>/g);
    for (const match of authorMatches) {
      authors.push(match[1].trim());
    }
    return {
      title,
      authors,
      year: yearMatch ? Number(yearMatch[1]) : undefined,
      source: "arxiv" as const,
      url: linkUrl.trim(),
    };
  });
}
