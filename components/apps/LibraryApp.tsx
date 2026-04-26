"use client";

import { useCallback, useEffect, useState } from "react";
import { useExperiment } from "@/hooks/use-experiment";
import { useWindowManager } from "@/hooks/use-window-manager";
import { useModal } from "@/hooks/use-modal";
import type { ExperimentSummary } from "@/lib/supabase/experiments";
import type { ExperimentPlan, Novelty, Reference } from "@/lib/types";

interface ExperimentDetail {
  id: string;
  hypothesis: string;
  novelty: Novelty | null;
  createdAt: string;
  plan: ExperimentPlan | null;
  references: Reference[];
}

export function LibraryApp() {
  const {
    hypothesis,
    status,
    plan,
    experimentId,
    loadFromHistory,
  } = useExperiment();
  const { openWindow, focusWindow } = useWindowManager();
  const { confirm } = useModal();
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

  useEffect(() => {
    if (status === "done" && experimentId) {
      void load();
    }
  }, [status, experimentId, load]);

  const handleLoadIntoPlan = useCallback(
    async (id: string) => {
      const ok = await loadFromHistory(id);
      if (ok) {
        openWindow("plan");
        focusWindow("plan");
        openWindow("lit-qc");
      }
    },
    [loadFromHistory, openWindow, focusWindow]
  );

  const handleRename = useCallback(
    async (id: string, title: string | null) => {
      // Optimistic update — the server-side PATCH is fire-and-forget
      // for hackathon scope. If it fails the next refresh will revert.
      setExperiments((prev) =>
        prev?.map((e) => (e.id === id ? { ...e, title } : e)) ?? prev
      );
      try {
        const res = await fetch(`/api/experiments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setLoadError(`Rename failed: ${(err as Error).message}`);
        void load();
      }
    },
    [load]
  );

  const handleDelete = useCallback(
    async (id: string, hypothesisPreview: string) => {
      const preview =
        hypothesisPreview.length > 140
          ? hypothesisPreview.slice(0, 140) + "…"
          : hypothesisPreview;
      const ok = await confirm({
        title: "Delete this experiment?",
        message: (
          <>
            <div
              className="mb-2 italic"
              style={{ color: "var(--color-text)", lineHeight: 1.5 }}
            >
              &ldquo;{preview}&rdquo;
            </div>
            <div>This also removes its plan, references, and any corrections. Cannot be undone.</div>
          </>
        ),
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true,
      });
      if (!ok) return;
      // Optimistic remove — drop from the list immediately, then verify
      // server-side. If the server returns an error, reload from source.
      setExperiments((prev) => prev?.filter((e) => e.id !== id) ?? prev);
      try {
        const res = await fetch(`/api/experiments/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setLoadError(`Delete failed: ${(err as Error).message}`);
        void load();
      }
    },
    [load, confirm]
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-[14px]" style={{ fontWeight: 600 }}>
            Library
          </h3>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
            Recent experiments persisted in Supabase. Click to expand · use Rename to give a run a short name · drag onto desktop to pin.
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
        {hypothesis && status !== "done" && status !== "queued" && (
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
                pinned={e.id === experimentId}
                inMemoryPlan={e.id === experimentId ? plan : null}
                onLoad={handleLoadIntoPlan}
                onDelete={handleDelete}
                onRename={handleRename}
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

interface ExperimentCardProps {
  exp: ExperimentSummary;
  pinned: boolean;
  inMemoryPlan: ExperimentPlan | null;
  onLoad: (id: string) => void;
  onDelete: (id: string, hypothesisPreview: string) => void;
  onRename: (id: string, title: string | null) => void;
}

function ExperimentCard({ exp, pinned, inMemoryPlan, onLoad, onDelete, onRename }: ExperimentCardProps) {
  const [expanded, setExpanded] = useState(pinned);
  const [detail, setDetail] = useState<ExperimentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(exp.title ?? "");

  const truncatedHypothesis =
    exp.hypothesis.length > 140 ? exp.hypothesis.slice(0, 140) + "…" : exp.hypothesis;
  const displayLabel = exp.title ?? truncatedHypothesis;
  const hasTitle = exp.title !== null && exp.title.length > 0;

  const commitRename = () => {
    const next = draft.trim();
    onRename(exp.id, next.length === 0 ? null : next);
    setEditing(false);
  };
  const cancelRename = () => {
    setDraft(exp.title ?? "");
    setEditing(false);
  };
  const beginRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDraft(exp.title ?? "");
    setEditing(true);
  };

  const created = new Date(exp.createdAt);
  const date = created.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = created.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const fetchDetail = useCallback(async () => {
    if (detail) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/experiments/${exp.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail((await res.json()) as ExperimentDetail);
    } catch (err) {
      setDetailError((err as Error).message ?? "Failed to load");
    } finally {
      setDetailLoading(false);
    }
  }, [detail, exp.id]);

  // Auto-fetch detail when card expands.
  useEffect(() => {
    if (expanded) void fetchDetail();
  }, [expanded, fetchDetail]);

  // Plan content for the expanded view: prefer in-memory plan when this card
  // is the current session (avoids the round-trip + shows the freshly-run
  // notes/runStats), fall back to fetched detail.plan.
  const shownPlan: ExperimentPlan | null = pinned && inMemoryPlan ? inMemoryPlan : detail?.plan ?? null;

  return (
    <li
      className="border"
      // Drag this card onto the desktop area to pin it as a shortcut.
      // Desktop.tsx onDrop reads the application/x-aliquot-experiment
      // payload and creates a PinnedExperiment.
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/x-aliquot-experiment",
          JSON.stringify({
            experimentId: exp.id,
            hypothesis: exp.hypothesis,
            domain: exp.domain,
          })
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
      style={{
        background: pinned ? "var(--color-surface-alt)" : "var(--color-surface)",
        borderColor: pinned ? "var(--color-accent)" : "var(--color-border)",
        borderRadius: 4,
        cursor: "grab",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (editing) return;
          setExpanded((v) => !v);
        }}
        onKeyDown={(e) => {
          if (editing) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="group flex w-full cursor-pointer flex-col items-stretch gap-1.5 p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              onBlur={commitRename}
              maxLength={120}
              placeholder="Short name (Esc to cancel, empty to clear)"
              className="min-w-0 flex-1 border bg-transparent px-1.5 py-0.5 text-[12.5px] outline-none"
              style={{
                color: "var(--color-text)",
                borderColor: "var(--color-accent)",
                borderRadius: 3,
                fontWeight: 600,
              }}
            />
          ) : (
            <span
              className="min-w-0 flex-1 text-[12.5px]"
              style={{
                color: "var(--color-text)",
                fontWeight: hasTitle ? 600 : 500,
                lineHeight: 1.4,
              }}
              title={hasTitle ? exp.hypothesis : undefined}
            >
              {displayLabel}
            </span>
          )}
          {!editing && (
            <button
              onClick={beginRename}
              className="shrink-0 border px-2 py-0.5 text-[10.5px] transition-colors"
              style={{
                background: "var(--color-surface-alt)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
                borderRadius: 3,
              }}
              title="Rename this experiment"
            >
              Rename
            </button>
          )}
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
      </div>

      {expanded && (
        <ExpandedDetail
          loading={detailLoading}
          error={detailError}
          plan={shownPlan}
          novelty={exp.novelty}
          references={detail?.references ?? []}
          confidence={exp.overallConfidence}
          onLoad={() => onLoad(exp.id)}
          onDelete={() => onDelete(exp.id, exp.hypothesis)}
          isLoaded={pinned}
        />
      )}
    </li>
  );
}

function ExpandedDetail({
  loading,
  error,
  plan,
  novelty,
  references,
  confidence,
  onLoad,
  onDelete,
  isLoaded,
}: {
  loading: boolean;
  error: string | null;
  plan: ExperimentPlan | null;
  novelty: Novelty | null;
  references: Reference[];
  confidence: number | null;
  onLoad: () => void;
  onDelete: () => void;
  isLoaded: boolean;
}) {
  if (loading) {
    return (
      <div
        className="space-y-2 border-t p-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}
      >
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="border-t p-3 text-[11.5px]"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface-alt)",
          color: "var(--color-error)",
        }}
      >
        Failed to load detail: {error}
      </div>
    );
  }

  return (
    <div
      className="border-t p-3 text-[11.5px]"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface-alt)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
      }}
    >
      {/* Top row: novelty + confidence + load + delete */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {novelty && (
          <span style={{ color: "var(--color-text)" }}>
            Novelty: <span style={{ fontWeight: 500 }}>{novelty.replace("_", " ")}</span>
          </span>
        )}
        {typeof confidence === "number" && (
          <span style={{ color: "var(--color-text)" }}>
            Confidence:{" "}
            <span style={{ fontWeight: 500 }}>{Math.round(confidence * 100)}%</span>
          </span>
        )}
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={onLoad}
            disabled={isLoaded || !plan}
            className="border px-2.5 py-1 text-[11px] transition-colors"
            style={{
              background: isLoaded ? "var(--color-surface)" : "var(--color-accent)",
              borderColor: isLoaded ? "var(--color-border)" : "var(--color-accent)",
              color: isLoaded ? "var(--color-text-muted)" : "white",
              borderRadius: 4,
              cursor: isLoaded || !plan ? "default" : "pointer",
            }}
          >
            {isLoaded ? "Loaded" : "Load in Plan window"}
          </button>
          <button
            onClick={onDelete}
            className="border px-2.5 py-1 text-[11px] transition-colors"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-error)",
              borderRadius: 4,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(185, 28, 28, 0.08)";
              e.currentTarget.style.borderColor = "var(--color-error)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-surface)";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
            title="Permanently delete this experiment"
          >
            Delete
          </button>
        </div>
      </div>

      {plan?.notes && (
        <Section label="Caveats">
          <p style={{ color: "var(--color-text)" }}>
            {plan.notes.length > 360 ? plan.notes.slice(0, 360) + "…" : plan.notes}
          </p>
        </Section>
      )}

      {plan?.protocol && plan.protocol.length > 0 && (
        <Section label={`Protocol (${plan.protocol.length} steps)`}>
          <ol className="space-y-1.5">
            {plan.protocol.slice(0, 3).map((s) => (
              <li key={s.index} style={{ color: "var(--color-text)" }}>
                <span
                  className="mr-2 font-mono text-[10px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {s.index}
                </span>
                {s.text.length > 200 ? s.text.slice(0, 200) + "…" : s.text}
              </li>
            ))}
            {plan.protocol.length > 3 && (
              <li style={{ color: "var(--color-text-muted)", fontSize: 10.5 }}>
                +{plan.protocol.length - 3} more steps
              </li>
            )}
          </ol>
        </Section>
      )}

      {plan?.materials && plan.materials.length > 0 && (
        <Section label={`Materials (${plan.materials.length})`}>
          <ul className="space-y-1">
            {plan.materials.slice(0, 5).map((m, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-x-2"
                style={{ color: "var(--color-text)" }}
              >
                <span>{m.reagent.length > 60 ? m.reagent.slice(0, 60) + "…" : m.reagent}</span>
                <span style={{ color: "var(--color-text-muted)", fontSize: 10.5 }}>
                  · {m.supplier} {m.catalogNumber}
                  {typeof m.unitPrice === "number" &&
                    ` · ${m.currency || "$"}${m.unitPrice.toFixed(2)}`}
                </span>
              </li>
            ))}
            {plan.materials.length > 5 && (
              <li style={{ color: "var(--color-text-muted)", fontSize: 10.5 }}>
                +{plan.materials.length - 5} more
              </li>
            )}
          </ul>
        </Section>
      )}

      {plan?.equipment && plan.equipment.length > 0 && (
        <Section label="Equipment">
          <ul className="list-disc pl-4 space-y-0.5" style={{ color: "var(--color-text)" }}>
            {plan.equipment.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Section>
      )}

      {plan?.budget && plan.budget.lines.length > 0 && (
        <Section label={`Budget — ${plan.budget.currency}${plan.budget.total.toLocaleString()} total`}>
          <ul className="space-y-0.5">
            {plan.budget.lines.map((l, i) => (
              <li key={i} className="flex justify-between" style={{ color: "var(--color-text)" }}>
                <span>{l.label}</span>
                <span className="tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                  {l.currency}
                  {l.amount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {references.length > 0 && (
        <Section label={`References (${references.length})`}>
          <ul className="space-y-0.5">
            {references.slice(0, 3).map((r, i) => (
              <li key={i} style={{ color: "var(--color-text)" }}>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="content-link"
                  >
                    {r.title}
                  </a>
                ) : (
                  r.title
                )}
                {r.year && (
                  <span style={{ color: "var(--color-text-muted)", fontSize: 10.5 }}>
                    {" "}
                    ({r.year})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div
        className="mb-1 text-[10px] font-semibold tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}
