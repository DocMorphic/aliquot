// Sample hypotheses wired as quick-start chips on the Hypothesis window
// so users can demo without typing. Each one names a specific intervention,
// a measurable outcome with a threshold, a mechanistic reason, and an
// implied control — the bar for "what makes a strong input."

export interface SampleHypothesis {
  id: string;
  domain: string;
  shortLabel: string;
  hypothesis: string;
  plainEnglish: string;
}

export const SAMPLE_HYPOTHESES: SampleHypothesis[] = [
  {
    id: "diagnostics-crp",
    domain: "Diagnostics",
    shortLabel: "Paper-based CRP biosensor",
    hypothesis:
      "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing.",
    plainEnglish:
      "Can we build a cheap, fast blood test for inflammation that works without lab equipment?",
  },
  {
    id: "gut-health-lgg",
    domain: "Gut Health",
    shortLabel: "L. rhamnosus GG in mice",
    hypothesis:
      "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.",
    plainEnglish:
      "Does a specific probiotic measurably strengthen the gut lining in mice?",
  },
  {
    id: "cell-biology-trehalose",
    domain: "Cell Biology",
    shortLabel: "Trehalose cryoprotectant for HeLa",
    hypothesis:
      "Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose's superior membrane stabilization at low temperatures.",
    plainEnglish:
      "Can we keep more cells alive when freezing them by swapping one preservative for another?",
  },
  {
    id: "climate-sporomusa",
    domain: "Climate",
    shortLabel: "Sporomusa CO₂ → acetate",
    hypothesis:
      "Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400 mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%.",
    plainEnglish:
      "Can a specific microbe be used to convert CO₂ into a useful chemical compound more efficiently than current methods?",
  },
];
