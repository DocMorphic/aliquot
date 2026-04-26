import type { AppDefinition } from "./types";

export const STORAGE_PREFIX = "aliquot";

export const STORAGE_KEYS = {
  theme: `${STORAGE_PREFIX}:theme`,
  brightness: `${STORAGE_PREFIX}:brightness`,
} as const;

export const DEFAULT_THEME = {
  mode: "light" as const,
  brightness: 100,
};

// =====================================================================
// Aliquot app registry
// =====================================================================
export const APP_REGISTRY: Record<string, AppDefinition> = {
  hypothesis: {
    id: "hypothesis",
    title: "Hypothesis",
    icon: "🧪",
    defaultWidth: 620,
    defaultHeight: 540,
    defaultX: 60,
    defaultY: 80,
    showInExplorer: true,
    showInTaskbar: true,
  },
  "lit-qc": {
    id: "lit-qc",
    title: "Literature QC",
    icon: "🔍",
    defaultWidth: 420,
    defaultHeight: 520,
    defaultX: 720,
    defaultY: 80,
    showInExplorer: true,
    showInTaskbar: true,
  },
  plan: {
    id: "plan",
    title: "Experiment Plan",
    icon: "📋",
    defaultWidth: 920,
    defaultHeight: 660,
    defaultX: 220,
    defaultY: 60,
    showInExplorer: true,
    showInTaskbar: true,
  },
  review: {
    id: "review",
    title: "Scientist Review",
    icon: "✍️",
    defaultWidth: 380,
    defaultHeight: 580,
    defaultX: 1180,
    defaultY: 80,
    showInExplorer: true,
    showInTaskbar: true,
  },
  library: {
    id: "library",
    title: "Library",
    icon: "📚",
    defaultWidth: 640,
    defaultHeight: 480,
    defaultX: 280,
    defaultY: 100,
    showInExplorer: true,
    showInTaskbar: true,
  },
  help: {
    id: "help",
    title: "Help",
    icon: "❓",
    defaultWidth: 560,
    defaultHeight: 520,
    defaultX: 320,
    defaultY: 100,
    showInExplorer: true,
    showInTaskbar: true,
  },
  settings: {
    id: "settings",
    title: "Settings",
    icon: "⚙️",
    defaultWidth: 480,
    defaultHeight: 380,
    defaultX: 360,
    defaultY: 120,
    showInExplorer: true,
    showInTaskbar: true,
  },
};

// =====================================================================
// AI model selection — change here to swap models project-wide.
// =====================================================================
export const MODELS = {
  // Fast classifier + confidence annotator
  fast: "claude-haiku-4-5",
  // Generator, skeptic, revise, verifier, lit-QC reasoning
  reason: "claude-sonnet-4-6",
} as const;

// Stage labels shown to the user during pipeline streaming
export const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  classifying: "Identifying scientific domain…",
  lit_qc: "Searching the literature…",
  generating: "Drafting protocol with grounded sources…",
  skeptic: "🔍 Senior PI reviewing for issues…",
  revising: "✏️ Revising based on critique…",
  verifying: "✅ Verifying catalog numbers…",
  scoring: "📊 Computing confidence scores…",
  done: "Plan ready",
  failed: "Generation failed",
};
