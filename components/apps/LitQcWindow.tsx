"use client";

import { useExperiment } from "@/hooks/use-experiment";
import type { Novelty } from "@/lib/types";

const NOVELTY_LABEL: Record<Novelty, string> = {
  not_found: "Not Found",
  similar: "Similar Work Exists",
  exact: "Exact Match Found",
};

const NOVELTY_TONE: Record<Novelty, string> = {
  not_found: "success",
  similar: "warn",
  exact: "error",
};

export function LitQcWindow() {
  const { novelty, references, status, hypothesis } = useExperiment();
  const isPending = status === "classifying" || status === "lit_qc";

  if (!hypothesis) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          Run a hypothesis to see literature QC.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <div
          className="text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          NOVELTY SIGNAL
        </div>
        <div className="mt-2">
          {isPending && novelty === null ? (
            <div className="skeleton h-7 w-40 rounded" />
          ) : novelty ? (
            <span className={`badge ${NOVELTY_TONE[novelty]}`}>
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: "currentColor" }}
              />
              {NOVELTY_LABEL[novelty]}
            </span>
          ) : (
            <span className="badge">—</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div
          className="mb-2 text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          REFERENCES
        </div>
        {isPending && references.length === 0 ? (
          <div className="space-y-2">
            <div className="skeleton h-16 w-full rounded" />
            <div className="skeleton h-16 w-full rounded" />
          </div>
        ) : references.length > 0 ? (
          <div className="space-y-2">
            {references.map((r, i) => (
              <a
                key={i}
                href={r.url || (r.doi ? `https://doi.org/${r.doi}` : "#")}
                target="_blank"
                rel="noreferrer"
                className="block border p-2.5 transition-colors"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border-strong)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                }}
              >
                <div
                  className="text-[12.5px]"
                  style={{ color: "var(--color-text)", lineHeight: 1.4 }}
                >
                  {r.title}
                </div>
                <div
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {r.authors.slice(0, 3).join(", ")}
                  {r.authors.length > 3 ? " et al." : ""}
                  {r.year ? ` · ${r.year}` : ""}
                  {" · "}
                  <span style={{ color: "var(--color-accent)" }}>
                    {r.source.replace("_", " ")}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
            No references surfaced for this hypothesis.
          </p>
        )}
      </div>
    </div>
  );
}
