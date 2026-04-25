"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type {
  ExperimentPlan,
  ExperimentStatus,
  Reference,
  Novelty,
  PipelineEvent,
} from "@/lib/types";

interface RefinementState {
  reason: string;
  suggestions: string[];
}

interface ExperimentState {
  experimentId: string | null;
  hypothesis: string;
  status: ExperimentStatus;
  stageMessage: string;
  novelty: Novelty | null;
  references: Reference[];
  plan: ExperimentPlan | null;
  refinement: RefinementState | null;
  error: string | null;
  /** Accumulated estimated API spend across all runs in this page
   *  session. Resets on reload. Surfaced in the menu bar. */
  sessionSpend: number;
  /** Number of full plan runs completed this session. */
  runsThisSession: number;
}

export interface RunOptions {
  currency?: "USD" | "EUR" | "GBP";
}

interface ExperimentContextValue extends ExperimentState {
  runExperiment: (hypothesis: string, options?: RunOptions) => Promise<void>;
  loadFromHistory: (experimentId: string) => Promise<boolean>;
  reset: () => void;
}

const initialState: ExperimentState = {
  experimentId: null,
  hypothesis: "",
  status: "queued",
  stageMessage: "",
  novelty: null,
  references: [],
  plan: null,
  refinement: null,
  error: null,
  sessionSpend: 0,
  runsThisSession: 0,
};

export const ExperimentContext = createContext<ExperimentContextValue | null>(null);

export function useExperiment(): ExperimentContextValue {
  const ctx = useContext(ExperimentContext);
  if (!ctx) {
    throw new Error("useExperiment must be used within ExperimentProvider");
  }
  return ctx;
}

export function useExperimentProvider(): ExperimentContextValue {
  const [state, setState] = useState<ExperimentState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const runExperiment = useCallback(
    async (hypothesis: string, options: RunOptions = {}) => {
      if (!hypothesis.trim()) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Reset per-run fields but preserve cumulative session counters.
      setState((prev) => ({
        ...initialState,
        sessionSpend: prev.sessionSpend,
        runsThisSession: prev.runsThisSession,
        hypothesis,
        status: "validating",
        stageMessage: "Checking hypothesis specificity…",
      }));

      try {
        const res = await fetch("/api/experiment/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hypothesis,
            currency: options.currency ?? "USD",
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Pipeline failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const evt of events) {
            const dataLines = evt
              .split("\n")
              .filter((l) => l.startsWith("data: "))
              .map((l) => l.slice(6));
            if (dataLines.length === 0) continue;
            const payload = dataLines.join("\n");
            try {
              const parsed = JSON.parse(payload) as PipelineEvent;
              applyEvent(parsed, setState);
              // Phase 2: as soon as the streaming pipeline finishes
              // its draft plan, fire the verify endpoint and merge the
              // verified plan back into state when it returns. We do
              // this here (instead of inside applyEvent) because the
              // verify call needs to be async-fire-and-forget — it
              // shouldn't block further events.
              if (
                parsed.type === "plan_done" &&
                parsed.plan.verificationPending &&
                isUuidLike(parsed.experimentId)
              ) {
                void verifyAndMerge(parsed.experimentId, setState, ctrl.signal);
              }
            } catch {
              // ignore malformed events
            }
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: (err as Error).message ?? "Pipeline error",
        }));
      }
    },
    []
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState);
  }, []);

  /**
   * Hydrate the experiment context with a persisted plan from history.
   * The Library window calls this when the user clicks "Load in Plan
   * window" — it lets us re-use the existing PlanWindow UI for browsing
   * past runs without writing a separate viewer.
   */
  const loadFromHistory = useCallback(async (experimentId: string) => {
    try {
      const res = await fetch(`/api/experiments/${experimentId}`, { cache: "no-store" });
      if (!res.ok) return false;
      const detail = (await res.json()) as {
        id: string;
        hypothesis: string;
        novelty: Novelty | null;
        plan: ExperimentPlan | null;
        references: Reference[];
      };
      if (!detail.plan) return false;
      abortRef.current?.abort();
      setState({
        ...initialState,
        experimentId: detail.id,
        hypothesis: detail.hypothesis,
        status: "done",
        stageMessage: "Loaded from history",
        novelty: detail.novelty,
        references: detail.references ?? [],
        plan: detail.plan,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  return { ...state, runExperiment, loadFromHistory, reset };
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id);
}

/**
 * Phase 2: fetch the verified plan from /api/experiment/[id]/verify
 * and merge it into the live state. Soft-fails — if the verify call
 * errors out the user keeps the un-verified plan but with the
 * verifying flag flipped off so the UI stops spinning.
 */
async function verifyAndMerge(
  experimentId: string,
  setState: React.Dispatch<React.SetStateAction<ExperimentState>>,
  signal: AbortSignal
) {
  try {
    const res = await fetch(`/api/experiment/${experimentId}/verify`, {
      method: "POST",
      signal,
    });
    if (!res.ok) throw new Error(`verify HTTP ${res.status}`);
    const data = (await res.json()) as { plan: ExperimentPlan };
    setState((prev) => {
      // Charge the Phase 2 delta (post-verify spend minus the Phase 1
      // estimate already counted) to the session spend.
      const phaseOneCost = prev.plan?.runStats?.estimatedCostUsd ?? 0;
      const totalCost = data.plan.runStats?.estimatedCostUsd ?? phaseOneCost;
      const delta = Math.max(0, totalCost - phaseOneCost);
      return {
        ...prev,
        plan: data.plan,
        status: "done",
        stageMessage: "Plan ready",
        sessionSpend: prev.sessionSpend + delta,
        runsThisSession: prev.runsThisSession + 1,
      };
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return;
    setState((prev) => {
      if (!prev.plan) return prev;
      return {
        ...prev,
        // Drop the verifying flag so the UI shows the plan as final
        // even if verification couldn't complete.
        plan: { ...prev.plan, verificationPending: false },
        status: "done",
        stageMessage: "Plan ready (verification skipped)",
      };
    });
  }
}

function applyEvent(
  event: PipelineEvent,
  setState: React.Dispatch<React.SetStateAction<ExperimentState>>
) {
  switch (event.type) {
    case "stage":
      setState((prev) => ({
        ...prev,
        status: event.stage,
        stageMessage: event.message,
      }));
      break;
    case "lit_qc":
      setState((prev) => ({
        ...prev,
        novelty: event.novelty,
        references: event.references,
      }));
      break;
    case "plan_partial":
      setState((prev) => ({
        ...prev,
        plan: prev.plan
          ? { ...prev.plan, ...event.plan }
          : (event.plan as ExperimentPlan),
      }));
      break;
    case "plan_done": {
      const phaseOneCost = event.plan.runStats?.estimatedCostUsd ?? 0;
      setState((prev) => ({
        ...prev,
        plan: event.plan,
        experimentId: event.experimentId,
        // Stay in "verifying" while Phase 2 runs; the verify response
        // flips us to "done" via verifyAndMerge below.
        status: event.plan.verificationPending ? "verifying" : "done",
        stageMessage: event.plan.verificationPending
          ? "Verifying catalog numbers…"
          : "Plan ready",
        // Charge Phase 1 to session spend; Phase 2 adds the verifier
        // delta when it completes.
        sessionSpend: prev.sessionSpend + phaseOneCost,
        runsThisSession: prev.runsThisSession + (event.plan.verificationPending ? 0 : 1),
      }));
      break;
    }
    case "needs_refinement":
      setState((prev) => ({
        ...prev,
        status: "needs_refinement",
        stageMessage: "Hypothesis needs refinement",
        refinement: { reason: event.reason, suggestions: event.suggestions },
      }));
      break;
    case "error":
      setState((prev) => ({
        ...prev,
        status: "failed",
        error: event.message,
      }));
      break;
  }
}
