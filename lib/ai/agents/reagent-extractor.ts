import { getAnthropic } from "../client";
import { MODELS } from "@/lib/constants";
import type { Domain } from "@/lib/types";
import { extractJson } from "../json";

const SYSTEM = `You are extracting the list of specific reagents, cell lines, animal models, and key consumables a scientist will need to run an experiment.

Given a hypothesis + domain, list 6-12 items. Each item should be specific enough that a supplier search will find a real product page:
- For antibodies: include clone, isotype, conjugate (e.g. "anti-CRP capture antibody, clone C7, mouse mAb")
- For cell lines: include the standard repository name (e.g. "HeLa cells (ATCC CCL-2)")
- For animals: include strain (e.g. "C57BL/6J mice")
- For chemicals: include grade where it matters (e.g. "trehalose dihydrate, cell culture grade")
- For media / kits / specialty items: include name + concentration / volume specs

Output STRICT JSON only:
{
  "reagents": [
    "<one specific reagent string>",
    "<another>",
    ...
  ]
}

Do not include trivial consumables (pipette tips, falcon tubes, vortexer). Focus on items that actually need a catalog number lookup.`;

export interface ExtractedReagents {
  reagents: string[];
}

export async function extractReagents(
  hypothesis: string,
  domain: Domain
): Promise<string[]> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 800,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Hypothesis:\n${hypothesis}\n\nDomain: ${domain}`,
      },
    ],
  });

  const text =
    res.content.find((b) => b.type === "text")?.type === "text"
      ? (res.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";

  const parsed = extractJson<ExtractedReagents>(text);
  if (!parsed?.reagents || !Array.isArray(parsed.reagents)) {
    return [];
  }
  // Deduplicate (case-insensitive) and cap at 12 to keep the
  // downstream Tavily fan-out bounded.
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const r of parsed.reagents) {
    const trimmed = r.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
    if (cleaned.length >= 8) break; // cap at 8 to keep Tavily fan-out + Sonnet input bounded
  }
  return cleaned;
}
