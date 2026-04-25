// =====================================================================
// Aliquot — domain types
// =====================================================================

// === Theme / chrome (kept from os-folio, simplified) ===
export type ThemeMode = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  brightness: number;
}

export interface WindowState {
  appId: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  preMaxPosition?: { x: number; y: number };
  preMaxSize?: { width: number; height: number };
}

export interface AppDefinition {
  id: string;
  title: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultX: number;
  defaultY: number;
  showInExplorer: boolean;
  showInTaskbar: boolean;
}

// === Aliquot — experiment domain ===

export type Domain = "biology" | "chemistry" | "physics" | "climate";

export type Novelty = "not_found" | "similar" | "exact";

export type ExperimentStatus =
  | "queued"
  | "classifying"
  | "lit_qc"
  | "generating"
  | "skeptic"
  | "revising"
  | "verifying"
  | "scoring"
  | "done"
  | "failed";

export interface Reference {
  doi?: string;
  url?: string;
  title: string;
  authors: string[];
  year?: number;
  source: "semantic_scholar" | "arxiv" | "protocols_io";
  similarity?: number;
}

export interface Citation {
  refId: string;
  url?: string;
  passage?: string;
}

export interface ProtocolStep {
  index: number;
  text: string;
  duration?: string;
  citations: Citation[];
  confidence?: number;
}

export interface MaterialItem {
  reagent: string;
  supplier: string;
  catalogNumber: string;
  quantity: string;
  unitPrice?: number;
  currency?: string;
  url?: string;
  alternates?: { supplier: string; price: number; url?: string }[];
  verified: boolean;
  confidence?: number;
}

export interface BudgetLine {
  category: "materials" | "labor" | "equipment" | "overhead";
  label: string;
  amount: number;
  currency: string;
  notes?: string;
}

export interface TimelinePhase {
  index: number;
  name: string;
  duration: string;
  durationDays: number;
  dependsOn: number[];
  description?: string;
}

export interface ValidationCriterion {
  metric: string;
  threshold: string;
  method: string;
  citations: Citation[];
}

export interface ExperimentPlan {
  hypothesis: string;
  domain: Domain;
  protocol: ProtocolStep[];
  materials: MaterialItem[];
  budget: {
    lines: BudgetLine[];
    total: number;
    currency: string;
  };
  timeline: TimelinePhase[];
  validation: ValidationCriterion[];
  references: Reference[];
  confidenceSummary: {
    overall: number;
    protocol: number;
    materials: number;
    budget: number;
    timeline: number;
    validation: number;
  };
  notes?: string;
}

// === Stretch goal: feedback loop ===

export interface Correction {
  id?: string;
  planId: string;
  domain: Domain;
  sectionPath: string;
  original?: string;
  corrected: string;
  rationale?: string;
  rating: number; // 1-5
}

// === Pipeline streaming events (SSE) ===

export type PipelineEvent =
  | { type: "stage"; stage: ExperimentStatus; message: string }
  | { type: "lit_qc"; novelty: Novelty; references: Reference[] }
  | { type: "plan_partial"; plan: Partial<ExperimentPlan> }
  | { type: "plan_done"; plan: ExperimentPlan; experimentId: string }
  | { type: "error"; message: string };

// === Window context (what data flows with each window) ===
export interface WindowContext {
  experimentId?: string;
  planSection?: "protocol" | "materials" | "budget" | "timeline" | "validation" | "provenance";
}
