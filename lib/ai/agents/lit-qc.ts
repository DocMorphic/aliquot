import { getAnthropic, cachedSystemBlock } from "../client";
import { MODELS } from "@/lib/constants";
import { searchOpenAlex } from "@/lib/search/openalex";
import { searchArxiv } from "@/lib/search/arxiv";
import type { Domain, Novelty, Reference } from "@/lib/types";
import { extractJson } from "../json";

// Trim a long hypothesis to its first ~120 chars for search; full
// hypotheses overweight common words and miss the distinctive nouns.
function searchKeywords(hypothesis: string): string {
  const trimmed = hypothesis.length > 120 ? hypothesis.slice(0, 120) : hypothesis;
  // Strip parenthetical clauses + commas which confuse keyword search.
  return trimmed.replace(/\([^)]+\)/g, "").replace(/[,]/g, " ").trim();
}

const SYSTEM = `You are a literature novelty assessor for a scientific experiment planning tool.

You receive:
- A scientific hypothesis
- A list of paper search results from Semantic Scholar and arXiv

Your job:
1. Decide whether this exact experiment (or something effectively identical) has been published.
2. Pick the 1-3 most relevant references for the user to follow up on.

Output STRICT JSON (no markdown, no prose) matching:
{
  "novelty": "not_found" | "similar" | "exact",
  "references": [
    { "index": <number from 0 of the result you picked>, "rationale": "<one short sentence>" }
  ]
}

Definitions:
- "exact" — a paper has tested the same intervention with the same measurable outcome on the same system
- "similar" — published work covers a substantial overlap (same intervention OR same outcome, but not the precise hypothesis)
- "not_found" — no published paper closely tests this exact hypothesis

Be conservative: lean "similar" over "exact" when in doubt.`;

interface LitQcLLMOutput {
  novelty: Novelty;
  references: { index: number; rationale: string }[];
}

export async function litQc(
  hypothesis: string,
  _domain: Domain
): Promise<{ novelty: Novelty; references: Reference[] }> {
  // Use a trimmed keyword query — full hypotheses are too long for these
  // search APIs and dilute relevance with common words.
  const q = searchKeywords(hypothesis);

  // OpenAlex is the primary source (broad coverage, no rate limits).
  // arXiv is supplementary for physics/CS/climate.
  const useArxiv = _domain === "physics" || _domain === "climate";
  const [openalexHits, arxivHits] = await Promise.all([
    searchOpenAlex(q, 6).catch((e) => {
      console.warn("[lit-qc] OpenAlex failed:", (e as Error).message);
      return [] as Reference[];
    }),
    useArxiv
      ? searchArxiv(q, 3).catch((e) => {
          console.warn("[lit-qc] arXiv failed:", (e as Error).message);
          return [] as Reference[];
        })
      : Promise.resolve([] as Reference[]),
  ]);

  const candidates = [...openalexHits, ...arxivHits];

  if (candidates.length === 0) {
    return { novelty: "not_found", references: [] };
  }

  const numbered = candidates
    .map(
      (c, i) =>
        `[${i}] ${c.title}\n    ${c.authors.slice(0, 4).join(", ")}${
          c.authors.length > 4 ? " et al." : ""
        }${c.year ? ` (${c.year})` : ""} — ${c.source}`
    )
    .join("\n");

  const client = getAnthropic();
  const res = await client.messages.create({
    model: MODELS.reason,
    max_tokens: 600,
    system: cachedSystemBlock(SYSTEM),
    messages: [
      {
        role: "user",
        content: `Hypothesis:\n${hypothesis}\n\nSearch results:\n${numbered}`,
      },
    ],
  });

  const text =
    res.content.find((b) => b.type === "text")?.type === "text"
      ? (res.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";

  const parsed = extractJson<LitQcLLMOutput>(text);
  if (!parsed) {
    // Fallback: surface top 2 results, conservative novelty signal
    return {
      novelty: candidates.length >= 3 ? "similar" : "not_found",
      references: candidates.slice(0, 2),
    };
  }

  const refs: Reference[] = parsed.references
    .map((r) => candidates[r.index])
    .filter((r): r is Reference => Boolean(r))
    .slice(0, 3);

  return {
    novelty: parsed.novelty,
    references: refs,
  };
}
