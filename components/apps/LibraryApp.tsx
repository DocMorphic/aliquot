"use client";

import { useCallback, useEffect, useState } from "react";
import { useExperiment } from "@/hooks/use-experiment";
import type { ExperimentSummary } from "@/lib/supabase/experiments";

export function LibraryApp() {
  const { hypothesis, status, plan, experimentId } = useExperiment();
  const [experiments, setExperiments] = useState<ExperimentSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/experiments?limit=30", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { experiments: ExperimentSummary[] };
      setExperiments(data.experiments);
    } catch (err) {
      setLoadError((err as Error).message ?? "Failed to load");
      setExperiments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh whenever a new experiment finishes — picks up the plan we
  // just persisted so the user sees their fresh run without manually
  // hitting refresh.
  useEffect(() => {
    if (status === "done" && experimentId) {
      void load();
    }
  }, [status, experimentId, load]);

  const isCurrentSession = (id: string) => id === experimentId;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-[14px]" style={{ fontWeight: 600 }}>
            Library
          </h3>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
            Recent experiments persisted in Supabase. Click to expand.
          </p>
        </div>
        <button
          onClick={load}
          disabled={isLoading}
          className="border px-2.5 py-1 text-[11px] transition-colors"
          style={{
            background: "var(--color-surface-alt)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-secondary)",
            borderRadius: 4,
          }}
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loadError && (
        <div
          className="border p-2 text-[11.5px]"
          style={{
            background: "rgba(185, 28, 28, 0.08)",
            borderColor: "var(--color-error)",
            color: "var(--color-error)",
            borderRadius: 4,
          }}
        >
          Failed to load library: {loadError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Pinned current-session card if it's running but not yet persisted */}
        {hypothesis && status !== "done" && (
          <CurrentRunningCard hypothesis={hypothesis} status={status} />
        )}

        {experiments === null && !loadError ? (
          <div className="space-y-2">
            <div className="skeleton h-16 w-full rounded" />
            <div className="skeleton h-16 w-full rounded" />
            <div className="skeleton h-16 w-full rounded" />
          </div>
        ) : experiments && experiments.length > 0 ? (
          <ul className="space-y-2">
            {experiments.map((e) => (
              <ExperimentCard
                key={e.id}
                exp={e}
                pinned={isCurrentSession(e.id)}
                fallbackPlan={isCurrentSession(e.id) ? plan : null}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            No experiments yet. Open the Hypothesis window and start one.
          </p>
        )}
      </div>
    </div>
  );
}

function CurrentRunningCard({
  hypothesis,
  status,
}: {
  hypothesis: string;
  status: string;
}) {
  return (
    <div
      className="mb-2 border p-3"
      style={{
        background: "rgba(30, 64, 175, 0.05)",
        borderColor: "var(--color-accent)",
        borderRadius: 4,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-accent)" }}
        >
          IN PROGRESS
        </span>
        <span className="badge accent" style={{ fontSize: 10 }}>
          {status}
        </span>
      </div>
      <p
        className="mt-1.5 text-[12px]"
        style={{ color: "var(--color-text)", lineHeight: 1.5 }}
      >
        {hypothesis}
      </p>
    </div>
  );
}

function ExperimentCard({
  exp,
  pinned,
  fallbackPlan,
}: {
  exp: ExperimentSummary;
  pinned: boolean;
  fallbackPlan: import("@/lib/types").ExperimentPlan | null;
}) {
  const [expanded, setExpanded] = useState(pinned);
  const created = new Date(exp.createdAt);
  const date = created.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = created.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <li
      className="border"
      style={{
        background: pinned ? "var(--color-surface-alt)" : "var(--color-surface)",
        borderColor: pinned ? "var(--color-accent)" : "var(--color-border)",
        borderRadius: 4,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-col items-stretch gap-1.5 p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="min-w-0 flex-1 text-[12.5px]"
            style={{ color: "var(--color-text)", fontWeight: 500, lineHeight: 1.4 }}
          >
            {exp.hypothesis.length > 140 ? exp.hypothesis.slice(0, 140) + "…" : exp.hypothesis}
          </span>
          {pinned && (
            <span className="badge accent shrink-0" style={{ fontSize: 10 }}>
              CURRENT
            </span>
          )}
        </div>
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {exp.domain && <span>{exp.domain}</span>}
          {exp.protocolStepsCount !== null && (
            <>
              <span>·</span>
              <span>{exp.protocolStepsCount} steps</span>
            </>
          )}
          {exp.materialsCount !== null && (
            <>
              <span>·</span>
              <span>{exp.materialsCount} materials</span>
            </>
          )}
          {exp.budgetTotal !== null && (
            <>
              <span>·</span>
              <span className="tabular-nums">
                {exp.budgetCurrency ?? "$"}
                {exp.budgetTotal.toLocaleString()}
              </span>
            </>
          )}
          <span className="ml-auto">
            {date} · {time}
          </span>
        </div>
      </button>

      {expanded && (
        <div
          className="border-t p-3 text-[11.5px]"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-secondary)",
            background: "var(--color-surface-alt)",
            lineHeight: 1.5,
          }}
        >
          <div className="font-mono text-[10.5px]" style={{ color: "var(--color-text-muted)" }}>
            ID: {exp.id}
          </div>
          {exp.novelty && (
            <div className="mt-1">
              Novelty: <span style={{ fontWeight: 500 }}>{exp.novelty.replace("_", " ")}</span>
            </div>
          )}
          {typeof exp.overallConfidence === "number" && (
            <div className="mt-1">
              Overall confidence:{" "}
              <span style={{ fontWeight: 500 }}>
                {Math.round(exp.overallConfidence * 100)}%
              </span>
            </div>
          )}
          {pinned && fallbackPlan?.notes && (
            <div className="mt-2" style={{ color: "var(--color-text)" }}>
              <span className="font-semibold">Caveats: </span>
              {fallbackPlan.notes.length > 220
                ? fallbackPlan.notes.slice(0, 220) + "…"
                : fallbackPlan.notes}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
