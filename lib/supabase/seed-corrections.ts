import type { Domain } from "@/lib/types";

/**
 * Seed corrections — plausible expert feedback to pre-populate the
 * corrections table so the feedback loop is "warm" on first demo run.
 *
 * Once the demo machine has env vars wired, run this against Supabase:
 *   import { seedCorrections } from "@/lib/supabase/seed-corrections";
 *   import { getServerSupabase } from "@/lib/supabase/client";
 *   await seedCorrections(getServerSupabase());
 *
 * The corrections will be retrieved by the Generator agent's
 * get_corrections tool when a similar hypothesis is submitted.
 */
export interface SeedCorrection {
  domain: Domain;
  sectionPath: string;
  original: string;
  corrected: string;
  rationale: string;
  rating: number;
}

export const SEED_CORRECTIONS: SeedCorrection[] = [
  {
    domain: "biology",
    sectionPath: "protocol",
    original: "Add primary antibody at 100 nM",
    corrected: "Add primary antibody at 1–10 nM (titrate to optimal)",
    rationale:
      "100 nM saturates and causes non-specific binding for most IgG primaries. Titrate from 1 to 10 nM for best signal-to-noise.",
    rating: 5,
  },
  {
    domain: "biology",
    sectionPath: "protocol",
    original: "Spin at 14000 rpm for 5 min",
    corrected: "Spin at 5,000 × g for 10 min",
    rationale:
      "RPM is centrifuge-specific. Always state ×g for reproducibility — 14k rpm in a microfuge is ~17k×g, way more than needed.",
    rating: 5,
  },
  {
    domain: "biology",
    sectionPath: "protocol",
    original: "Block with 5% BSA",
    corrected: "Block with 1% BSA + 0.05% Tween-20",
    rationale:
      "5% BSA is unnecessary and can mask weak signals. 1% with detergent gives equivalent blocking with better signal.",
    rating: 4,
  },
  {
    domain: "biology",
    sectionPath: "materials",
    original: "Anti-CRP antibody (catalog #X)",
    corrected: "Specify clone (e.g. C7 capture, C2 detection) and isotype",
    rationale:
      "Without clone specification the protocol is irreproducible — antibody clones from the same vendor often have different epitopes and sensitivities.",
    rating: 5,
  },
  {
    domain: "biology",
    sectionPath: "validation",
    original: "Compare against ELISA",
    corrected: "Compare against ELISA on ≥30 paired samples with Bland-Altman analysis",
    rationale:
      "A simple correlation coefficient is misleading for clinical diagnostics. Bland-Altman shows bias and limits of agreement.",
    rating: 5,
  },
  {
    domain: "biology",
    sectionPath: "timeline",
    original: "Cell expansion: 2 days",
    corrected: "Cell expansion: 5–7 days from thaw to working stock",
    rationale:
      "HeLa cells need at least 2 passages after thaw before they're metabolically stable for experiments.",
    rating: 4,
  },
  {
    domain: "chemistry",
    sectionPath: "materials",
    original: "Order Pt mesh anode",
    corrected: "Specify mesh size (e.g. 52 mesh, 0.1 mm wire) and surface area",
    rationale:
      "Pt mesh comes in many specs. Without mesh size + surface area, current densities are not comparable.",
    rating: 4,
  },
  {
    domain: "climate",
    sectionPath: "protocol",
    original: "Sparge with CO2",
    corrected: "Sparge with CO2 at 5 mL/min through a 0.22 µm filter, monitor pH",
    rationale:
      "Unmonitored CO2 sparging acidifies the medium and crashes Sporomusa. Buffer + flow control are essential.",
    rating: 5,
  },
];

export async function seedCorrections(
  supabase: import("@supabase/supabase-js").SupabaseClient
): Promise<void> {
  // STUB: when wired, this should:
  // 1. For each seed correction, compute an embedding via Anthropic.
  //    (We may use a separate embedding provider since Anthropic does not
  //    expose embeddings directly — Voyage AI is the recommended pair.)
  // 2. Insert into `corrections` with a synthesized plan_id reference or
  //    NULL plan_id (consider relaxing the FK in schema.sql).
  console.log(`[seed-corrections] would seed ${SEED_CORRECTIONS.length} entries.`);
  void supabase;
}
