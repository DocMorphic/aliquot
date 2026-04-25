import type {
  ExperimentPlan,
  Domain,
  Novelty,
  Reference,
  PipelineEvent,
} from "@/lib/types";

/**
 * Pipeline orchestrator. Yields PipelineEvent objects as each stage completes.
 * The /api/experiment/run route wraps this in an SSE response.
 *
 * STATUS: skeleton. Stage 2-7 are stubs that delegate to TODO modules
 * under lib/ai/agents/. The mock implementation below returns a
 * deterministic plan keyed off the hypothesis text so the UI can be
 * developed and demoed without API keys. Replace with real calls once
 * agents are implemented.
 */
export async function* runPipeline(
  hypothesis: string
): AsyncGenerator<PipelineEvent, void, unknown> {
  // Stage 1: classify
  yield { type: "stage", stage: "classifying", message: "Identifying scientific domain…" };
  const domain = mockClassifyDomain(hypothesis);
  await wait(400);

  // Stage 2: lit QC
  yield { type: "stage", stage: "lit_qc", message: "Searching the literature…" };
  await wait(700);
  const lit = mockLitQc(hypothesis, domain);
  yield { type: "lit_qc", novelty: lit.novelty, references: lit.references };
  await wait(200);

  // Stage 3: generator
  yield { type: "stage", stage: "generating", message: "Drafting protocol with grounded sources…" };
  await wait(1200);
  const draft = mockGeneratePlan(hypothesis, domain, lit.references);
  yield { type: "plan_partial", plan: draft };

  // Stage 4: skeptic
  yield { type: "stage", stage: "skeptic", message: "🔍 Senior PI reviewing for issues…" };
  await wait(900);

  // Stage 5: revise
  yield { type: "stage", stage: "revising", message: "✏️ Revising based on critique…" };
  await wait(700);

  // Stage 6: verifier
  yield {
    type: "stage",
    stage: "verifying",
    message: `✅ Verifying ${draft.materials?.length ?? 0} catalog numbers…`,
  };
  await wait(900);

  // Stage 7: confidence annotator
  yield { type: "stage", stage: "scoring", message: "📊 Computing confidence scores…" };
  await wait(500);
  const finalPlan = annotateConfidence(draft);

  yield { type: "plan_done", plan: finalPlan, experimentId: cryptoRandomId() };
}

// =====================================================================
// Helpers + mock implementations (replace with real agents)
// =====================================================================

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function cryptoRandomId(): string {
  // Pseudo-uuid for the mock. Real impl persists to Supabase and returns the row id.
  return `mock-${Math.random().toString(36).slice(2, 10)}`;
}

function mockClassifyDomain(hypothesis: string): Domain {
  const t = hypothesis.toLowerCase();
  if (/co2|cathode|electrochem|microbe|sporomusa|carbon capture/.test(t)) return "climate";
  if (/biosensor|electrochemical|crp|elisa|whole blood/.test(t)) return "biology";
  if (/cells|hela|cryo|protocol|antibody|probiotic|mice|gut/.test(t)) return "biology";
  if (/quantum|laser|optic|particle/.test(t)) return "physics";
  if (/synthesis|catalyst|reaction|polymer|chemistry/.test(t)) return "chemistry";
  return "biology";
}

function mockLitQc(
  hypothesis: string,
  domain: Domain
): { novelty: Novelty; references: Reference[] } {
  // Deterministic mock — the diagnostics example mentions CRP biosensors
  // which have a rich literature, so we return "similar".
  const t = hypothesis.toLowerCase();
  const novelty: Novelty =
    /crp|biosensor|paper-based/.test(t) ? "similar" :
    /trehalose|cryoprotect/.test(t) ? "similar" :
    /sporomusa|microbial electrosynthesis/.test(t) ? "similar" :
    "not_found";

  const references: Reference[] = [
    {
      title:
        domain === "climate"
          ? "Microbial electrosynthesis of acetate by Sporomusa ovata at low cathode potentials"
          : "Paper-based electrochemical biosensors for point-of-care diagnostics",
      authors: ["Park J", "Singh A", "Müller R"],
      year: 2023,
      source: "semantic_scholar",
      doi: "10.1021/acsnano.3c00001",
      similarity: 0.84,
    },
    {
      title:
        domain === "climate"
          ? "Cathode potential effects on CO2 reduction in bioelectrochemical systems"
          : "Sensitivity benchmarking of paper electrochemical immunosensors",
      authors: ["Chen L", "Garcia M", "Patel R", "Tanaka H"],
      year: 2022,
      source: "arxiv",
      url: "https://arxiv.org/abs/2210.04567",
      similarity: 0.71,
    },
  ];

  return { novelty, references };
}

function mockGeneratePlan(
  hypothesis: string,
  domain: Domain,
  references: Reference[]
): ExperimentPlan {
  // Mock plan keyed roughly off the hypothesis. This exists ONLY so the UI
  // is demo-able before real API keys are wired. Replace with the real
  // Generator + Verifier output once env is configured.
  const isCRP = /crp|biosensor|paper-based/i.test(hypothesis);
  const isCryo = /trehalose|cryoprotect|hela/i.test(hypothesis);
  const isProbiotic = /lactobacillus|probiotic|gut|mice|fitc-dextran/i.test(hypothesis);
  const isClimate = /sporomusa|cathode|co2|acetate/i.test(hypothesis);

  if (isCRP) return crpPlan(hypothesis, domain, references);
  if (isCryo) return cryoPlan(hypothesis, domain, references);
  if (isProbiotic) return probioticPlan(hypothesis, domain, references);
  if (isClimate) return climatePlan(hypothesis, domain, references);
  return crpPlan(hypothesis, domain, references); // fallback to a known-good demo
}

function annotateConfidence(plan: ExperimentPlan): ExperimentPlan {
  const protocol = plan.protocol.map((s) => ({
    ...s,
    confidence: s.confidence ?? 0.78 + Math.random() * 0.15,
  }));
  const materials = plan.materials.map((m) => ({
    ...m,
    confidence: m.confidence ?? (m.verified ? 0.88 + Math.random() * 0.1 : 0.55 + Math.random() * 0.2),
  }));
  return {
    ...plan,
    protocol,
    materials,
    confidenceSummary: {
      overall: 0.83,
      protocol: 0.85,
      materials: 0.81,
      budget: 0.78,
      timeline: 0.82,
      validation: 0.88,
    },
  };
}

// === Domain-specific mock plans ======================================
// These are stand-ins. Replace once the Generator agent is real.

function crpPlan(hypothesis: string, domain: Domain, references: Reference[]): ExperimentPlan {
  return {
    hypothesis,
    domain,
    protocol: [
      { index: 1, text: "Cut Whatman No. 1 chromatography paper into 5 mm × 25 mm strips. Apply hydrophobic SU-8 barriers via wax printing to define detection and counter electrode regions.", duration: "2 h", citations: [{ refId: "R1", url: "https://www.protocols.io/" }] },
      { index: 2, text: "Screen-print carbon working/counter electrodes and Ag/AgCl reference electrode using conductive ink. Cure at 80 °C for 30 minutes.", duration: "1.5 h", citations: [{ refId: "R1" }] },
      { index: 3, text: "Functionalize working electrode by dropping 5 µL of 50 µg/mL anti-CRP capture antibody (mouse mAb, clone C7) in carbonate buffer pH 9.6. Incubate 1 h at 4 °C.", duration: "1 h + overnight", citations: [{ refId: "R2" }] },
      { index: 4, text: "Block with 1% BSA in PBS-T (0.05% Tween-20) for 30 min at room temp. Wash 3× with PBS-T.", duration: "45 min", citations: [{ refId: "R2" }] },
      { index: 5, text: "Apply 10 µL whole blood sample (or PBS spiked with recombinant human CRP at 0.1, 0.5, 1, 5, 10 mg/L) directly to inlet pad. Allow capillary wicking, 5 min.", duration: "5 min", citations: [{ refId: "R1" }] },
      { index: 6, text: "Apply 10 µL of HRP-conjugated detection anti-CRP antibody (clone C2). Wait 3 min, then add 10 µL TMB-H2O2 substrate.", duration: "5 min", citations: [{ refId: "R2" }] },
      { index: 7, text: "Run differential pulse voltammetry (−0.2 → +0.4 V vs Ag/AgCl, 10 mV step, 50 ms pulse). Record peak current at +0.15 V vs CRP concentration.", duration: "10 min", citations: [{ refId: "R1" }] },
    ],
    materials: [
      { reagent: "Anti-CRP capture antibody (clone C7)", supplier: "Sigma-Aldrich", catalogNumber: "C7-100", quantity: "100 µg", unitPrice: 412, currency: "$", url: "https://www.sigmaaldrich.com/", verified: true },
      { reagent: "Anti-CRP detection antibody (clone C2)-HRP", supplier: "Thermo Fisher", catalogNumber: "MA1-91254-HRP", quantity: "100 µg", unitPrice: 489, currency: "$", url: "https://www.thermofisher.com/", verified: true, alternates: [{ supplier: "Abcam", price: 522 }] },
      { reagent: "Recombinant human CRP standard", supplier: "Sigma-Aldrich", catalogNumber: "C4063", quantity: "1 mg", unitPrice: 295, currency: "$", url: "https://www.sigmaaldrich.com/US/en/product/sigma/c4063", verified: true },
      { reagent: "Whatman No. 1 chromatography paper", supplier: "Cytiva", catalogNumber: "3001-861", quantity: "100 sheets", unitPrice: 78, currency: "$", verified: true },
      { reagent: "Conductive carbon ink (BQ221)", supplier: "Gwent Group", catalogNumber: "BQ221", quantity: "100 g", unitPrice: 165, currency: "$", verified: true },
      { reagent: "Ag/AgCl ink (C2050308D2)", supplier: "Gwent Group", catalogNumber: "C2050308D2", quantity: "50 g", unitPrice: 142, currency: "$", verified: true },
      { reagent: "TMB substrate solution", supplier: "Thermo Fisher", catalogNumber: "34028", quantity: "500 mL", unitPrice: 88, currency: "$", url: "https://www.thermofisher.com/order/catalog/product/34028", verified: true },
      { reagent: "PBS-T washing buffer", supplier: "Sigma-Aldrich", catalogNumber: "P3563", quantity: "10 packs", unitPrice: 64, currency: "$", verified: true },
      { reagent: "BSA (Fraction V)", supplier: "Sigma-Aldrich", catalogNumber: "A9418", quantity: "100 g", unitPrice: 188, currency: "$", verified: true },
    ],
    budget: {
      lines: [
        { category: "materials", label: "Antibodies + standards", amount: 1196, currency: "$" },
        { category: "materials", label: "Paper, inks, substrates", amount: 537, currency: "$" },
        { category: "labor", label: "1 graduate researcher × 4 weeks", amount: 4200, currency: "$" },
        { category: "equipment", label: "Potentiostat (rental, 4 weeks)", amount: 800, currency: "$", notes: "Existing lab equipment may eliminate this line." },
        { category: "overhead", label: "University indirect (15%)", amount: 1010, currency: "$" },
      ],
      total: 7743,
      currency: "$",
    },
    timeline: [
      { index: 1, name: "Electrode fabrication & QC", duration: "1 week", durationDays: 7, dependsOn: [] },
      { index: 2, name: "Antibody immobilization optimization", duration: "1 week", durationDays: 7, dependsOn: [1] },
      { index: 3, name: "Standard curve + LOD characterization", duration: "1.5 weeks", durationDays: 10, dependsOn: [2] },
      { index: 4, name: "Whole-blood validation (n ≥ 30)", duration: "1.5 weeks", durationDays: 10, dependsOn: [3] },
      { index: 5, name: "ELISA cross-validation + analysis", duration: "1 week", durationDays: 7, dependsOn: [4] },
    ],
    validation: [
      { metric: "Limit of detection (LOD)", threshold: "< 0.5 mg/L CRP", method: "3σ blank-noise method on calibration curve, n = 5 replicates per concentration", citations: [{ refId: "R2" }] },
      { metric: "Time-to-result", threshold: "< 10 min from sample drop to readout", method: "Stopwatch from sample application to potentiostat read-out", citations: [{ refId: "R1" }] },
      { metric: "Concordance with ELISA", threshold: "Pearson r ≥ 0.9 across 30 patient samples", method: "Bland-Altman + linear regression vs CardioPhase hsCRP ELISA", citations: [{ refId: "R2" }] },
    ],
    references,
    confidenceSummary: { overall: 0.83, protocol: 0.85, materials: 0.81, budget: 0.78, timeline: 0.82, validation: 0.88 },
  };
}

function cryoPlan(hypothesis: string, domain: Domain, references: Reference[]): ExperimentPlan {
  return {
    hypothesis,
    domain,
    protocol: [
      { index: 1, text: "Culture HeLa cells (ATCC CCL-2) in DMEM + 10% FBS + 1% Pen-Strep until 80% confluence.", duration: "3 days", citations: [{ refId: "R1" }] },
      { index: 2, text: "Trypsinize, neutralize, and count cells using hemocytometer or automated counter. Adjust to 2 × 10⁶ cells/mL.", duration: "30 min", citations: [{ refId: "R1" }] },
      { index: 3, text: "Prepare two freezing media: (A) standard 10% DMSO in FBS; (B) 10% trehalose + 5% DMSO in FBS.", duration: "20 min", citations: [{ refId: "R2" }] },
      { index: 4, text: "Aliquot 1 mL of cell suspension into cryovials with each medium. Cool at −1 °C/min in a Mr. Frosty container to −80 °C overnight.", duration: "16 h", citations: [{ refId: "R1" }] },
      { index: 5, text: "Transfer to liquid nitrogen vapor phase. Store ≥ 7 days.", duration: "7+ days", citations: [{ refId: "R1" }] },
      { index: 6, text: "Thaw rapidly in 37 °C water bath. Dilute 1:10 in pre-warmed medium. Pellet at 200 × g, 5 min.", duration: "10 min", citations: [{ refId: "R2" }] },
      { index: 7, text: "Quantify post-thaw viability via trypan blue exclusion AND flow cytometry with PI/Annexin V at 24 h post-thaw.", duration: "1.5 h", citations: [{ refId: "R2" }] },
    ],
    materials: [
      { reagent: "HeLa cells (CCL-2)", supplier: "ATCC", catalogNumber: "CCL-2", quantity: "1 vial", unitPrice: 575, currency: "$", verified: true, url: "https://www.atcc.org/products/ccl-2" },
      { reagent: "DMEM", supplier: "Thermo Fisher", catalogNumber: "11965092", quantity: "500 mL", unitPrice: 32, currency: "$", verified: true },
      { reagent: "Fetal Bovine Serum (FBS)", supplier: "Sigma-Aldrich", catalogNumber: "F2442", quantity: "500 mL", unitPrice: 412, currency: "$", verified: true },
      { reagent: "DMSO (cell culture grade)", supplier: "Sigma-Aldrich", catalogNumber: "D2650", quantity: "100 mL", unitPrice: 78, currency: "$", verified: true },
      { reagent: "D-(+)-Trehalose dihydrate", supplier: "Sigma-Aldrich", catalogNumber: "T9531", quantity: "100 g", unitPrice: 102, currency: "$", verified: true, url: "https://www.sigmaaldrich.com/US/en/product/sigma/t9531" },
      { reagent: "Annexin V/PI apoptosis kit", supplier: "Thermo Fisher", catalogNumber: "V13242", quantity: "100 tests", unitPrice: 392, currency: "$", verified: true },
      { reagent: "Cryovials (2 mL)", supplier: "Corning", catalogNumber: "430488", quantity: "100/case", unitPrice: 56, currency: "$", verified: true },
      { reagent: "Mr. Frosty Freezing Container", supplier: "Thermo Fisher", catalogNumber: "5100-0001", quantity: "1", unitPrice: 95, currency: "$", verified: true },
    ],
    budget: {
      lines: [
        { category: "materials", label: "Cells + media + reagents", amount: 1742, currency: "$" },
        { category: "materials", label: "Consumables (cryovials, plates)", amount: 156, currency: "$" },
        { category: "labor", label: "1 researcher × 3 weeks", amount: 3150, currency: "$" },
        { category: "equipment", label: "Flow cytometer access (8 h)", amount: 480, currency: "$" },
        { category: "overhead", label: "Indirect (15%)", amount: 829, currency: "$" },
      ],
      total: 6357,
      currency: "$",
    },
    timeline: [
      { index: 1, name: "Cell expansion to working stock", duration: "1 week", durationDays: 7, dependsOn: [] },
      { index: 2, name: "Cryopreservation runs (n = 6 each condition)", duration: "1 week", durationDays: 7, dependsOn: [1] },
      { index: 3, name: "Storage (≥ 7 days in LN₂)", duration: "1 week", durationDays: 7, dependsOn: [2] },
      { index: 4, name: "Thaw + viability assays", duration: "3 days", durationDays: 3, dependsOn: [3] },
      { index: 5, name: "Statistics + write-up", duration: "4 days", durationDays: 4, dependsOn: [4] },
    ],
    validation: [
      { metric: "Δ post-thaw viability", threshold: "≥ +15 percentage points (trehalose vs DMSO)", method: "Trypan blue + Annexin V/PI flow, paired t-test, n = 6", citations: [{ refId: "R2" }] },
      { metric: "Recovery growth rate", threshold: "Doubling time within 10% of fresh control by passage 2", method: "Confluence tracking via incubator imaging", citations: [{ refId: "R1" }] },
    ],
    references,
    confidenceSummary: { overall: 0.85, protocol: 0.88, materials: 0.84, budget: 0.8, timeline: 0.85, validation: 0.88 },
  };
}

function probioticPlan(hypothesis: string, domain: Domain, references: Reference[]): ExperimentPlan {
  return {
    hypothesis,
    domain,
    protocol: [
      { index: 1, text: "Acclimate C57BL/6J mice (n = 12 per group, 8 weeks old, male) to facility for 7 days. House 4 per cage, standard chow.", duration: "1 week", citations: [{ refId: "R1" }] },
      { index: 2, text: "Randomize into 2 groups: control (PBS gavage) and treatment (1 × 10⁹ CFU L. rhamnosus GG in 100 µL PBS, daily oral gavage).", duration: "Day 1", citations: [{ refId: "R1" }] },
      { index: 3, text: "Daily gavage for 28 days. Weekly body-weight + stool consistency scoring.", duration: "4 weeks", citations: [{ refId: "R1" }] },
      { index: 4, text: "On day 28, gavage 600 mg/kg FITC-dextran (4 kDa). Collect serum 4 h post-gavage. Measure plasma fluorescence (485/528 nm).", duration: "1 day", citations: [{ refId: "R2" }] },
      { index: 5, text: "Sacrifice; harvest distal ileum. Process for paraffin-embedded sections (5 µm) and snap-freeze samples for RNA/protein.", duration: "Day 29", citations: [{ refId: "R2" }] },
      { index: 6, text: "Quantify claudin-1 + occludin via Western blot (β-actin loading control) and IHC (anti-claudin-1, anti-occludin).", duration: "3 days", citations: [{ refId: "R2" }] },
    ],
    materials: [
      { reagent: "C57BL/6J mice (24 total)", supplier: "Jackson Laboratory", catalogNumber: "000664", quantity: "24 mice", unitPrice: 36, currency: "$", verified: true, url: "https://www.jax.org/strain/000664" },
      { reagent: "Lactobacillus rhamnosus GG (LGG)", supplier: "ATCC", catalogNumber: "53103", quantity: "1 vial", unitPrice: 285, currency: "$", verified: true },
      { reagent: "FITC-dextran 4 kDa", supplier: "Sigma-Aldrich", catalogNumber: "FD4", quantity: "1 g", unitPrice: 198, currency: "$", verified: true, url: "https://www.sigmaaldrich.com/US/en/product/sigma/fd4" },
      { reagent: "Anti-claudin-1 antibody", supplier: "Thermo Fisher", catalogNumber: "71-7800", quantity: "100 µL", unitPrice: 312, currency: "$", verified: true },
      { reagent: "Anti-occludin antibody", supplier: "Thermo Fisher", catalogNumber: "71-1500", quantity: "100 µL", unitPrice: 305, currency: "$", verified: true },
      { reagent: "MRS broth (Lactobacillus media)", supplier: "Sigma-Aldrich", catalogNumber: "69966", quantity: "500 g", unitPrice: 118, currency: "$", verified: true },
    ],
    budget: {
      lines: [
        { category: "materials", label: "Animals (n = 24)", amount: 864, currency: "$" },
        { category: "materials", label: "Antibodies + assays + media", amount: 1218, currency: "$" },
        { category: "labor", label: "Animal husbandry + dosing × 5 weeks", amount: 4500, currency: "$" },
        { category: "labor", label: "Histology + Western blot", amount: 1800, currency: "$" },
        { category: "equipment", label: "Plate reader + microscope time", amount: 360, currency: "$" },
        { category: "overhead", label: "Indirect (15%)", amount: 1311, currency: "$" },
      ],
      total: 10053,
      currency: "$",
    },
    timeline: [
      { index: 1, name: "Acclimation + LGG culture prep", duration: "1 week", durationDays: 7, dependsOn: [] },
      { index: 2, name: "Daily gavage × 28 days", duration: "4 weeks", durationDays: 28, dependsOn: [1] },
      { index: 3, name: "FITC-dextran assay + sacrifice", duration: "2 days", durationDays: 2, dependsOn: [2] },
      { index: 4, name: "Histology + Western blot", duration: "5 days", durationDays: 5, dependsOn: [3] },
      { index: 5, name: "Statistical analysis + figures", duration: "3 days", durationDays: 3, dependsOn: [4] },
    ],
    validation: [
      { metric: "Δ intestinal permeability", threshold: "≥ 30% reduction (treatment vs control)", method: "Plasma FITC-dextran fluorescence, t-test, n = 12 per group", citations: [{ refId: "R2" }] },
      { metric: "Tight junction protein expression", threshold: "Significant upregulation (p < 0.05) of claudin-1 AND occludin", method: "Western blot densitometry vs β-actin", citations: [{ refId: "R2" }] },
    ],
    references,
    confidenceSummary: { overall: 0.84, protocol: 0.86, materials: 0.83, budget: 0.81, timeline: 0.85, validation: 0.85 },
  };
}

function climatePlan(hypothesis: string, domain: Domain, references: Reference[]): ExperimentPlan {
  return {
    hypothesis,
    domain,
    protocol: [
      { index: 1, text: "Culture Sporomusa ovata (DSM 2662) anaerobically in DSM 311 medium with H₂/CO₂ headspace until OD₆₀₀ ≈ 0.4.", duration: "5 days", citations: [{ refId: "R1" }] },
      { index: 2, text: "Set up dual-chamber bioelectrochemical cell with graphite-fiber cathode (50 cm²) and Pt-mesh anode separated by Nafion 117 membrane.", duration: "1 day", citations: [{ refId: "R2" }] },
      { index: 3, text: "Sterilize cathode chamber. Inoculate with 50 mL S. ovata culture in defined growth medium with bicarbonate-phosphate buffer.", duration: "0.5 day", citations: [{ refId: "R1" }] },
      { index: 4, text: "Apply −400 mV vs SHE using a potentiostat (3-electrode setup with Ag/AgCl reference). Sparge cathode chamber with CO₂ at 5 mL/min.", duration: "Days 0–14", citations: [{ refId: "R2" }] },
      { index: 5, text: "Sample headspace + liquid every 12 h. Quantify acetate via HPLC (Aminex HPX-87H column, 5 mM H₂SO₄ mobile phase).", duration: "Daily", citations: [{ refId: "R1" }] },
    ],
    materials: [
      { reagent: "Sporomusa ovata DSM 2662", supplier: "DSMZ", catalogNumber: "DSM 2662", quantity: "1 vial", unitPrice: 220, currency: "€", verified: true },
      { reagent: "Graphite fibers (PAN-based)", supplier: "Toray", catalogNumber: "T300", quantity: "1 m²", unitPrice: 145, currency: "$", verified: true },
      { reagent: "Pt-mesh anode (52 mesh, 0.1 mm)", supplier: "Sigma-Aldrich", catalogNumber: "298093", quantity: "1 piece (5 cm × 5 cm)", unitPrice: 412, currency: "$", verified: true },
      { reagent: "Nafion 117 membrane", supplier: "Sigma-Aldrich", catalogNumber: "292567", quantity: "1 sheet", unitPrice: 198, currency: "$", verified: true },
      { reagent: "Ag/AgCl reference electrode", supplier: "BASi", catalogNumber: "MF-2052", quantity: "1", unitPrice: 138, currency: "$", verified: true },
      { reagent: "DSM 311 medium components", supplier: "Sigma-Aldrich", catalogNumber: "var.", quantity: "Bulk", unitPrice: 240, currency: "$", verified: true },
      { reagent: "HPLC Aminex HPX-87H column", supplier: "Bio-Rad", catalogNumber: "1250140", quantity: "1", unitPrice: 1250, currency: "$", verified: true },
    ],
    budget: {
      lines: [
        { category: "materials", label: "Microbe + electrodes + membrane", amount: 1113, currency: "$" },
        { category: "materials", label: "Media + reagents + HPLC consumables", amount: 1490, currency: "$" },
        { category: "labor", label: "Postdoc × 3 weeks", amount: 5400, currency: "$" },
        { category: "equipment", label: "Potentiostat + HPLC time", amount: 1200, currency: "$" },
        { category: "overhead", label: "Indirect (15%)", amount: 1380, currency: "$" },
      ],
      total: 10583,
      currency: "$",
    },
    timeline: [
      { index: 1, name: "Culture expansion + cell setup", duration: "1 week", durationDays: 7, dependsOn: [] },
      { index: 2, name: "Bioelectrochemical run (14 days)", duration: "2 weeks", durationDays: 14, dependsOn: [1] },
      { index: 3, name: "HPLC quantification + Faradaic efficiency", duration: "3 days", durationDays: 3, dependsOn: [2] },
      { index: 4, name: "Statistical analysis vs benchmarks", duration: "3 days", durationDays: 3, dependsOn: [3] },
    ],
    validation: [
      { metric: "Acetate production rate", threshold: "≥ 150 mmol/L/day (steady-state, days 4–14)", method: "HPLC acetate quantification, n ≥ 3 biological replicates", citations: [{ refId: "R1" }] },
      { metric: "Improvement vs benchmark", threshold: "≥ 20% over published Sporomusa rates at −400 mV", method: "One-tailed t-test vs literature mean", citations: [{ refId: "R2" }] },
    ],
    references,
    confidenceSummary: { overall: 0.81, protocol: 0.83, materials: 0.79, budget: 0.78, timeline: 0.82, validation: 0.85 },
  };
}
