"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type {
  Domain,
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
  runsThisSession: number;
}

export interface RunOptions {
  currency?: "USD" | "EUR" | "GBP";
}

interface ExperimentContextValue extends ExperimentState {
  runExperiment: (hypothesis: string, options?: RunOptions) => Promise<void>;
  cancelExperiment: () => void;
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
        runsThisSession: prev.runsThisSession,
        hypothesis,
        status: "validating",
        stageMessage: "Checking hypothesis specificity…",
      }));

      try {
        // === Phase 1: SSE — validator + classifier + lit_qc ===
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
        let experimentStarted: { experimentId: string; domain: Domain } | null = null;

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
              if (parsed.type === "experiment_started" && isUuidLike(parsed.experimentId)) {
                experimentStarted = {
                  experimentId: parsed.experimentId,
                  domain: parsed.domain,
                };
              }
              if (parsed.type === "needs_refinement" || parsed.type === "error") {
                experimentStarted = null;
              }
            } catch {
              // ignore malformed events
            }
          }
        }

        if (!experimentStarted) return;

        // === Phase 2: POST /generate — generator only ===
        setState((prev) => ({
          ...prev,
          status: "generating",
          stageMessage: "Drafting protocol with grounded sources…",
        }));
        const genRes = await fetch(
          `/api/experiment/${experimentStarted.experimentId}/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currency: options.currency ?? "USD" }),
            signal: ctrl.signal,
          }
        );
        if (!genRes.ok) {
          // Pull the structured error body so the UI can show the
          // actual reason (e.g. "Generator exceeded 55s") + hint.
          let detail: { error?: string; hint?: string; elapsedMs?: number } = {};
          try {
            detail = await genRes.json();
          } catch {
            // body was not JSON — fall back to status text
          }
          const msg =
            detail.error ??
            `Generate failed (HTTP ${genRes.status})`;
          const fullMsg = detail.hint ? `${msg} · ${detail.hint}` : msg;
          throw new Error(fullMsg);
        }
        const gen = (await genRes.json()) as { plan: ExperimentPlan };
        setState((prev) => ({
          ...prev,
          plan: gen.plan,
          experimentId: experimentStarted!.experimentId,
          status: "verifying",
          stageMessage: "Verifying catalog numbers…",
        }));

        // === Phase 3: POST /verify — verifier + score ===
        const verifyRes = await fetch(
          `/api/experiment/${experimentStarted.experimentId}/verify`,
          { method: "POST", signal: ctrl.signal }
        );
        if (!verifyRes.ok) {
          // Verify is non-critical — the user already has a plan from
          // Phase 2. Log the error but settle to "done" so the UI
          // doesn't bounce to a failed state.
          console.warn(`[verify] HTTP ${verifyRes.status} — continuing without verification`);
          setState((prev) => {
            if (!prev.plan) return prev;
            return {
              ...prev,
              plan: { ...prev.plan, verificationPending: false },
              status: "done",
              stageMessage: "Plan ready (verification skipped)",
              runsThisSession: prev.runsThisSession + 1,
            };
          });
          return;
        }
        const verified = (await verifyRes.json()) as { plan: ExperimentPlan };
        setState((prev) => ({
          ...prev,
          plan: verified.plan,
          status: "done",
          stageMessage: "Plan ready",
          runsThisSession: prev.runsThisSession + 1,
        }));
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          // Cancellation — leave state where the user stopped, but mark
          // as failed so the UI knows to show "cancelled".
          setState((prev) => ({
            ...prev,
            status: prev.plan ? "done" : "failed",
            stageMessage: prev.plan ? "Plan ready (cancelled mid-verify)" : "Cancelled",
          }));
          return;
        }
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: (err as Error).message ?? "Pipeline error",
        }));
      }
    },
    []
  );

  const cancelExperiment = useCallback(() => {
    abortRef.current?.abort();
  }, []);

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
      setState((prev) => ({
        ...initialState,
        runsThisSession: prev.runsThisSession,
        experimentId: detail.id,
        hypothesis: detail.hypothesis,
        status: "done",
        stageMessage: "Loaded from history",
        novelty: detail.novelty,
        references: detail.references ?? [],
        plan: detail.plan,
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { ...state, runExperiment, cancelExperiment, loadFromHistory, reset };
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id);
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
    case "experiment_started":
      setState((prev) => ({
        ...prev,
        experimentId: event.experimentId,
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
      // Legacy event — kept for compat with older deployed versions if a
      // user has a stale tab. New flow doesn't emit this from SSE.
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
