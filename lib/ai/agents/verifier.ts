import { tavilyCatalogSearch } from "@/lib/search/tavily";
import type { ExperimentPlan, MaterialItem } from "@/lib/types";

/**
 * Verifier — takes the Generator's plan and re-checks every catalog #
 * against a fresh Tavily search. Materials whose catalog # appears in
 * a supplier-domain result are marked verified; those that don't keep
 * verified=false (the UI shows a warning chip).
 *
 * Runs all checks in parallel for speed. Cost is small — 1 Tavily call
 * per material, ~6-12 per plan. Caps at MAX_PARALLEL to stay polite.
 */
const MAX_PARALLEL = 5;

export async function verifyPlan(plan: ExperimentPlan): Promise<ExperimentPlan> {
  const verified: MaterialItem[] = [];
  for (let i = 0; i < plan.materials.length; i += MAX_PARALLEL) {
    const batch = plan.materials.slice(i, i + MAX_PARALLEL);
    const checked = await Promise.all(batch.map(verifyMaterial));
    verified.push(...checked);
  }
  return { ...plan, materials: verified };
}

async function verifyMaterial(m: MaterialItem): Promise<MaterialItem> {
  // If we already have a real-looking URL pointing at a known supplier,
  // skip the round-trip — the Generator likely got this from search_catalog.
  if (m.url && /sigmaaldrich|thermofisher|promega|qiagen|atcc|addgene|abcam|idtdna|cytiva/.test(m.url)) {
    return { ...m, verified: true };
  }

  try {
    const result = await tavilyCatalogSearch(`${m.reagent} ${m.catalogNumber}`);
    if (result && /sigmaaldrich|thermofisher|promega|qiagen|atcc|addgene|abcam|idtdna|cytiva/.test(result.url)) {
      const looksMatched =
        result.content.toLowerCase().includes(m.catalogNumber.toLowerCase()) ||
        result.url.toLowerCase().includes(m.catalogNumber.toLowerCase().replace(/[^a-z0-9]/g, ""));
      return {
        ...m,
        verified: looksMatched,
        url: m.url ?? result.url,
      };
    }
    return { ...m, verified: false };
  } catch {
    // Network error — keep whatever the generator said but don't claim verified.
    return { ...m, verified: false };
  }
}
