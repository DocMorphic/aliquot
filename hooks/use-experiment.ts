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

      setState({
        ...initialState,
        hypothesis,
        status: "validating",
        stageMessage: "Checking hypothesis specificity…",
      });

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
    case "plan_done":
      setState((prev) => ({
        ...prev,
        plan: event.plan,
        experimentId: event.experimentId,
        status: "done",
        stageMessage: "Plan ready",
      }));
      break;
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
