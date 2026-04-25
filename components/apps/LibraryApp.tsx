"use client";

import { useExperiment } from "@/hooks/use-experiment";

export function LibraryApp() {
  const { hypothesis, status, plan } = useExperiment();

  // For 24h scope: shows the current session's experiment only.
  // Multi-experiment history is stretch-stretch.
  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h3 className="text-[14px]" style={{ fontWeight: 600 }}>
          Library
        </h3>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
          Experiments from this session. Past plans are persisted in Supabase.
        </p>
      </div>

      {hypothesis ? (
        <div
          className="border p-3"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            borderRadius: 4,
          }}
        >
          <div className="flex items-baseline justify-between">
            <span
              className="text-[10.5px] font-semibold tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              CURRENT
            </span>
            <span className="badge accent" style={{ fontSize: 10 }}>
              {status}
            </span>
          </div>
          <p
            className="mt-2 text-[12.5px]"
            style={{ color: "var(--color-text)", lineHeight: 1.5 }}
          >
            {hypothesis}
          </p>
          {plan && (
            <div
              className="mt-2 text-[11px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {plan.protocol.length} protocol steps · {plan.materials.length} materials ·{" "}
              {plan.budget.currency}
              {plan.budget.total.toLocaleString()} total
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          No experiments yet. Open the Hypothesis window and start one.
        </p>
      )}
    </div>
  );
}
