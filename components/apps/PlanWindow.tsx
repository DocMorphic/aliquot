"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useExperiment } from "@/hooks/use-experiment";
import { useWindowManager } from "@/hooks/use-window-manager";
import { STAGE_LABELS } from "@/lib/constants";
import type {
  ExperimentPlan,
  ProtocolStep,
  MaterialItem,
  BudgetLine,
  TimelinePhase,
  ValidationCriterion,
} from "@/lib/types";

type Tab =
  | "protocol"
  | "materials"
  | "equipment"
  | "budget"
  | "timeline"
  | "validation"
  | "references"
  | "files"
  | "caveats";

const TABS: { id: Tab; label: string }[] = [
  { id: "protocol", label: "Protocol" },
  { id: "materials", label: "Materials" },
  { id: "equipment", label: "Equipment" },
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "validation", label: "Validation" },
  { id: "references", label: "References" },
  { id: "files", label: "Files" },
  { id: "caveats", label: "Caveats" },
];

export function PlanWindow() {
  const { plan, status, stageMessage, hypothesis, error, experimentId } = useExperiment();
  const { openWindow, focusWindow } = useWindowManager();
  const [tab, setTab] = useState<Tab>("protocol");

  const isPending = status !== "done" && status !== "failed" && status !== "queued";

  if (!hypothesis) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          Run a hypothesis from the Hypothesis window to see the plan here.
        </p>
      </div>
    );
  }

  // Pipeline paused waiting for the user to confirm or refine — the
  // actionable UI lives in the Hypothesis window. Show a clear nudge
  // here so the user isn't staring at a stuck loader.
  if (status === "needs_confirmation" || status === "needs_refinement") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="text-[28px]" style={{ marginBottom: 8 }}>
          ✋
        </div>
        <h3 className="text-[15px]" style={{ fontWeight: 600 }}>
          {status === "needs_confirmation"
            ? "Confirm the rewritten hypothesis"
            : "Pick a refined hypothesis"}
        </h3>
        <p
          className="mt-2 max-w-[400px] text-[12.5px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {status === "needs_confirmation"
            ? "Your hypothesis was vague — Aliquot rewrote it into a proper experimental claim. Open the Hypothesis window to accept, edit, or run as-is."
            : "Your input was too vague to plan against. Open the Hypothesis window to pick a refined version or rewrite it yourself."}
        </p>
        <button
          onClick={() => {
            openWindow("hypothesis");
            focusWindow("hypothesis");
          }}
          className="mt-4 px-4 py-2 text-[12.5px] font-medium transition-colors"
          style={{
            background: "var(--color-accent)",
            color: "white",
            borderRadius: 4,
          }}
        >
          Open Hypothesis window
        </button>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="badge error">Pipeline failed</p>
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
          {error || "Something went wrong while generating the plan."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div
        className="flex w-[150px] shrink-0 flex-col border-r"
        style={{
          background: "var(--color-surface-alt)",
          borderColor: "var(--color-border)",
        }}
      >
        <div
          className="px-3 py-3 text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          PLAN
        </div>
        {TABS.map((t) => {
          const hasCaveats = t.id === "caveats" && plan?.notes && plan.notes.trim().length > 0;
          const isActive = tab === t.id;
          return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center justify-between px-3 py-1.5 text-left text-[12.5px] transition-colors"
            style={{
              background: isActive ? "var(--color-accent)" : "transparent",
              color: isActive ? "white" : "var(--color-text)",
            }}
            onMouseEnter={(e) => {
              if (!isActive)
                e.currentTarget.style.background = "var(--color-surface-hover)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <span className="flex items-center gap-1.5">
              {t.label}
              {hasCaveats && !isActive && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--color-warn)" }}
                  title="The plan has caveats from the AI scientist review"
                />
              )}
            </span>
          </button>
          );
        })}

        <div className="mt-auto p-3">
          <button
            onClick={() => openWindow("review")}
            disabled={!plan}
            className="w-full border px-2 py-1.5 text-[12px] transition-colors"
            style={{
              background: !plan ? "var(--color-surface-alt)" : "var(--color-surface-solid)",
              borderColor: "var(--color-border-strong)",
              color: !plan ? "var(--color-text-dim)" : "var(--color-text)",
              cursor: !plan ? "not-allowed" : "pointer",
              borderRadius: 4,
            }}
          >
            Review & Correct
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {isPending && (
          <PipelineProgress status={status} stageMessage={stageMessage} />
        )}

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {tab === "protocol" && <ProtocolTab plan={plan} pending={isPending} />}
          {tab === "materials" && <MaterialsTab plan={plan} pending={isPending} />}
          {tab === "equipment" && <EquipmentTab plan={plan} pending={isPending} />}
          {tab === "budget" && <BudgetTab plan={plan} pending={isPending} />}
          {tab === "timeline" && <TimelineTab plan={plan} pending={isPending} />}
          {tab === "validation" && <ValidationTab plan={plan} pending={isPending} />}
          {tab === "references" && <ReferencesTab plan={plan} pending={isPending} />}
          {tab === "files" && <FilesTab experimentId={experimentId} />}
          {tab === "caveats" && <CaveatsTab plan={plan} pending={isPending} />}
        </div>

        {plan?.runStats && status === "done" && (
          <div
            className="shrink-0 border-t px-5 py-2 text-[10.5px] tabular-nums"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "var(--color-surface-alt)",
            }}
          >
            Generated in {(plan.runStats.durationMs / 1000).toFixed(1)} s
            {typeof plan.runStats.estimatedCostUsd === "number" &&
              ` · ~$${plan.runStats.estimatedCostUsd.toFixed(2)} API cost`}
            {typeof plan.runStats.toolCalls === "number" &&
              ` · ${plan.runStats.toolCalls} tool calls`}
          </div>
        )}
      </div>
    </div>
  );
}

function ProtocolTab({ plan, pending }: { plan: ExperimentPlan | null; pending: boolean }) {
  if (!plan?.protocol?.length)
    return <EmptyOrSkeleton pending={pending} hint="Protocol steps appear here." />;
  return (
    <ol className="space-y-3">
      {plan.protocol.map((step) => (
        <ProtocolStepRow key={step.index} step={step} />
      ))}
    </ol>
  );
}

function ProtocolStepRow({ step }: { step: ProtocolStep }) {
  return (
    <li
      className="border p-3"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: 4 }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
          STEP {step.index}
        </span>
        {typeof step.confidence === "number" && <ConfidenceMeter value={step.confidence} />}
      </div>
      <p className="mt-1 text-[13px]" style={{ color: "var(--color-text)", lineHeight: 1.5 }}>
        {step.text}
      </p>
      {step.duration && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          ⏱ {step.duration}
        </div>
      )}
      {step.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {step.citations.map((c, i) => (
            <a
              key={i}
              href={c.url || "#"}
              target="_blank"
              rel="noreferrer"
              className="badge accent"
              style={{ fontSize: 10 }}
            >
              📎 {c.refId}
            </a>
          ))}
        </div>
      )}
    </li>
  );
}

function MaterialsTab({ plan, pending }: { plan: ExperimentPlan | null; pending: boolean }) {
  if (!plan?.materials?.length)
    return <EmptyOrSkeleton pending={pending} hint="Materials with catalog numbers appear here." />;
  const verifiedCount = plan.materials.filter((m) => m.verified).length;
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
        <span>{plan.materials.length} reagents</span>
        <span>
          {verifiedCount}/{plan.materials.length} catalog #s verified via supplier search
        </span>
      </div>
      <ul className="space-y-2">
        {plan.materials.map((m, i) => (
          <MaterialCard key={i} m={m} />
        ))}
      </ul>
    </div>
  );
}

function MaterialCard({ m }: { m: MaterialItem }) {
  const priceStr =
    typeof m.unitPrice === "number"
      ? `${m.currency || "$"}${m.unitPrice.toFixed(2)}`
      : null;
  return (
    <li
      className="border p-3"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        borderRadius: 4,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="min-w-0 flex-1 text-[13px]"
          style={{ color: "var(--color-text)", fontWeight: 500, lineHeight: 1.4 }}
          title={m.reagent}
        >
          {m.reagent}
        </span>
        {m.verified ? (
          <span className="badge success shrink-0" style={{ fontSize: 10 }}>
            ✓ verified
          </span>
        ) : (
          <span className="badge warn shrink-0" style={{ fontSize: 10 }}>
            ? unverified
          </span>
        )}
      </div>
      <div
        className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span>{m.supplier}</span>
        <span>·</span>
        {m.url ? (
          <a
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="content-link font-mono"
            style={{ fontSize: 11 }}
          >
            {m.catalogNumber}
          </a>
        ) : (
          <span className="font-mono" style={{ fontSize: 11 }}>
            {m.catalogNumber}
          </span>
        )}
        <span>·</span>
        <span>{m.quantity}</span>
        {priceStr && (
          <>
            <span>·</span>
            <span className="tabular-nums" style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
              {priceStr}
            </span>
          </>
        )}
        {typeof m.confidence === "number" && (
          <span className="ml-auto">
            <ConfidenceMeter value={m.confidence} />
          </span>
        )}
      </div>
      {m.alternates && m.alternates.length > 0 && (
        <div
          className="mt-1.5 text-[10.5px]"
          style={{ color: "var(--color-text-dim)" }}
        >
          Alternates:{" "}
          {m.alternates
            .map((a) => `${a.supplier} ${a.price ? `${m.currency || "$"}${a.price}` : ""}`)
            .join(" · ")}
        </div>
      )}
    </li>
  );
}

function EquipmentTab({ plan, pending }: { plan: ExperimentPlan | null; pending: boolean }) {
  const equipment = plan?.equipment ?? [];
  if (equipment.length === 0)
    return (
      <EmptyOrSkeleton
        pending={pending}
        hint="Major equipment (centrifuges, plate readers, microscopes) needed beyond reagents will appear here."
      />
    );
  return (
    <ul className="space-y-2">
      {equipment.map((e, i) => (
        <li
          key={i}
          className="border p-3 text-[13px]"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            borderRadius: 4,
            color: "var(--color-text)",
          }}
        >
          {e}
        </li>
      ))}
    </ul>
  );
}

function BudgetTab({ plan, pending }: { plan: ExperimentPlan | null; pending: boolean }) {
  if (!plan?.budget?.lines?.length)
    return <EmptyOrSkeleton pending={pending} hint="Budget breakdown appears here." />;

  // Aggregate by category for the stacked-bar overview.
  const byCategory = new Map<string, number>();
  for (const l of plan.budget.lines) {
    byCategory.set(l.category, (byCategory.get(l.category) ?? 0) + l.amount);
  }
  const categories = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
  const total = plan.budget.total;
  const currency = plan.budget.currency;
  const symbol = currencySymbol(currency);

  // Stable color per category — keeps the legend↔bar correspondence
  // obvious when the user re-renders.
  const COLORS: Record<string, string> = {
    materials: "#1E40AF",
    labor: "#0F766E",
    equipment: "#B45309",
    overhead: "#6D28D9",
  };
  const colorFor = (c: string) => COLORS[c] ?? "var(--color-text-muted)";

  return (
    <div>
      {/* Top: prominent total + cost-per-step rough metric for context */}
      <div
        className="mb-4 flex items-baseline justify-between border-b pb-3"
        style={{ borderColor: "var(--color-border-strong)" }}
      >
        <div>
          <div
            className="text-[10.5px] font-semibold tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            TOTAL ESTIMATED COST
          </div>
          <div
            className="mt-0.5 text-[26px] tabular-nums"
            style={{ color: "var(--color-text)", fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            {symbol}
            {total.toLocaleString()}
          </div>
        </div>
        {plan.protocol.length > 0 && (
          <div className="text-right">
            <div
              className="text-[10.5px] font-semibold tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              COST PER STEP
            </div>
            <div
              className="mt-0.5 text-[15px] tabular-nums"
              style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
            >
              ~{symbol}
              {Math.round(total / plan.protocol.length).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Stacked bar — visual share by category */}
      <div className="mb-2">
        <div
          className="mb-1 text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          BREAKDOWN
        </div>
        <div
          className="flex h-3 w-full overflow-hidden"
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            background: "var(--color-surface-alt)",
          }}
        >
          {categories.map(([cat, amt]) => (
            <div
              key={cat}
              title={`${cat}: ${symbol}${amt.toLocaleString()} (${Math.round((amt / total) * 100)}%)`}
              style={{
                width: `${(amt / total) * 100}%`,
                background: colorFor(cat),
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {categories.map(([cat, amt]) => (
            <span key={cat} className="flex items-center gap-1.5" style={{ color: "var(--color-text-secondary)" }}>
              <span
                className="inline-block h-2.5 w-2.5"
                style={{ background: colorFor(cat), borderRadius: 2 }}
              />
              <span style={{ textTransform: "capitalize" }}>{cat}</span>
              <span className="tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                {symbol}
                {amt.toLocaleString()} ({Math.round((amt / total) * 100)}%)
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div
          className="mb-2 text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          LINE ITEMS
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr style={{ color: "var(--color-text-muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th className="pb-2 text-left font-semibold">Category</th>
              <th className="pb-2 text-left font-semibold">Item</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
              <th className="pb-2 text-right font-semibold">% of total</th>
            </tr>
          </thead>
          <tbody>
            {plan.budget.lines.map((l, i) => (
              <BudgetRow key={i} l={l} total={total} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function currencySymbol(s: string): string {
  if (s === "USD" || s === "$") return "$";
  if (s === "EUR" || s === "€") return "€";
  if (s === "GBP" || s === "£") return "£";
  return s;
}

function BudgetRow({ l, total }: { l: BudgetLine; total: number }) {
  const pct = total > 0 ? (l.amount / total) * 100 : 0;
  return (
    <tr style={{ borderTop: "1px solid var(--color-border)" }}>
      <td className="py-2 align-top">
        <span className="badge" style={{ fontSize: 10 }}>{l.category}</span>
      </td>
      <td className="py-2 align-top" style={{ color: "var(--color-text)" }}>
        {l.label}
        {l.notes && (
          <div className="mt-0.5 text-[10.5px]" style={{ color: "var(--color-text-muted)" }}>
            {l.notes}
          </div>
        )}
      </td>
      <td className="py-2 text-right align-top tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
        {currencySymbol(l.currency)}
        {l.amount.toLocaleString()}
      </td>
      <td
        className="py-2 text-right align-top tabular-nums text-[11px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        {pct.toFixed(1)}%
      </td>
    </tr>
  );
}

function TimelineTab({ plan, pending }: { plan: ExperimentPlan | null; pending: boolean }) {
  if (!plan?.timeline?.length)
    return <EmptyOrSkeleton pending={pending} hint="Project timeline appears here." />;
  const maxDays = plan.timeline.reduce((acc, p) => Math.max(acc, p.durationDays), 0);
  return (
    <div className="space-y-2">
      {plan.timeline.map((p) => (
        <TimelineRow key={p.index} p={p} maxDays={maxDays} />
      ))}
    </div>
  );
}

function TimelineRow({ p, maxDays }: { p: TimelinePhase; maxDays: number }) {
  const widthPct = Math.max(8, Math.min(100, (p.durationDays / Math.max(maxDays, 1)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span style={{ color: "var(--color-text)" }}>
          <span className="font-mono mr-2 text-[10.5px]" style={{ color: "var(--color-text-muted)" }}>
            P{p.index}
          </span>
          {p.name}
        </span>
        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {p.duration}
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded" style={{ background: "var(--color-surface-alt)" }}>
        <div
          className="h-full rounded"
          style={{
            width: `${widthPct}%`,
            background: "var(--color-accent)",
            opacity: 0.85,
          }}
        />
      </div>
      {p.description && (
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
          {p.description}
        </p>
      )}
    </div>
  );
}

function ValidationTab({ plan, pending }: { plan: ExperimentPlan | null; pending: boolean }) {
  if (!plan?.validation?.length)
    return <EmptyOrSkeleton pending={pending} hint="Validation criteria appear here." />;
  return (
    <ul className="space-y-3">
      {plan.validation.map((v, i) => (
        <ValidationRow key={i} v={v} />
      ))}
    </ul>
  );
}

function ValidationRow({ v }: { v: ValidationCriterion }) {
  return (
    <li
      className="border p-3"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: 4 }}
    >
      <div className="text-[12.5px] font-medium" style={{ color: "var(--color-text)" }}>
        {v.metric}
      </div>
      <div className="mt-1 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
        Threshold: <span className="font-mono">{v.threshold}</span>
      </div>
      <div className="mt-1 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
        Method: {v.method}
      </div>
    </li>
  );
}

function CaveatsTab({ plan, pending }: { plan: ExperimentPlan | null; pending: boolean }) {
  const notes = plan?.notes?.trim();
  const confidence = plan?.confidenceSummary;
  if (!notes && !confidence)
    return (
      <EmptyOrSkeleton
        pending={pending}
        hint="Caveats and confidence breakdown appear here once a plan is generated."
      />
    );

  const items = notes ? parseCaveats(notes) : null;

  return (
    <div className="space-y-5">
      {confidence && <ConfidenceChart confidence={confidence} />}

      {notes && (
        <div>
          <div
            className="mb-2 text-[10.5px] font-semibold tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            CAVEATS
          </div>
          <p
            className="mb-3 text-[11.5px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Things to know before running this protocol — assumptions made by the AI scientist,
            known failure points, and items the bench should double-check.
          </p>
          {items ? (
        <ol className="space-y-2 pl-4 list-decimal" style={{ color: "var(--color-text)", lineHeight: 1.6 }}>
          {items.map((it, i) => (
            <li key={i} className="text-[12.5px]">
              {it}
            </li>
          ))}
        </ol>
      ) : (
        <div
          className="border p-3 text-[12.5px]"
          style={{
            background: "rgba(180, 83, 9, 0.05)",
            borderColor: "var(--color-warn)",
            borderRadius: 4,
            color: "var(--color-text)",
            lineHeight: 1.6,
          }}
        >
          {notes}
        </div>
      )}
        </div>
      )}
    </div>
  );
}

/** Horizontal-bars chart showing confidence breakdown across the 6
 *  plan dimensions. Pure SVG so no dep, plays a tiny grow-in
 *  animation on first paint. */
function ConfidenceChart({
  confidence,
}: {
  confidence: NonNullable<ExperimentPlan["confidenceSummary"]>;
}) {
  const rows: { label: string; value: number; key: keyof typeof confidence }[] = [
    { label: "Overall", value: confidence.overall, key: "overall" },
    { label: "Protocol", value: confidence.protocol, key: "protocol" },
    { label: "Materials", value: confidence.materials, key: "materials" },
    { label: "Budget", value: confidence.budget, key: "budget" },
    { label: "Timeline", value: confidence.timeline, key: "timeline" },
    { label: "Validation", value: confidence.validation, key: "validation" },
  ];
  return (
    <div>
      <div
        className="mb-2 text-[10.5px] font-semibold tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        CONFIDENCE BREAKDOWN
      </div>
      <div
        className="border p-3"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          borderRadius: 4,
        }}
      >
        <div className="space-y-1.5">
          {rows.map((r) => {
            const pct = Math.round(r.value * 100);
            const tone = pct >= 80 ? "" : pct >= 65 ? "medium" : "low";
            const color =
              tone === "low"
                ? "var(--color-error)"
                : tone === "medium"
                ? "var(--color-warn)"
                : "var(--color-success)";
            return (
              <div key={r.key} className="flex items-center gap-3 text-[11.5px]">
                <span
                  style={{ color: r.key === "overall" ? "var(--color-text)" : "var(--color-text-secondary)", width: 80, fontWeight: r.key === "overall" ? 600 : 400 }}
                >
                  {r.label}
                </span>
                <div
                  className="flex-1 overflow-hidden"
                  style={{
                    background: "var(--color-surface-alt)",
                    border: "1px solid var(--color-border)",
                    height: 8,
                    borderRadius: 3,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: color,
                      transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </div>
                <span
                  className="font-mono tabular-nums"
                  style={{ color: "var(--color-text-muted)", width: 36, textAlign: "right" }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Try to split numbered-list notes into individual items.
 *  Returns null if the text doesn't look like a list. */
function parseCaveats(text: string): string[] | null {
  // Match "1. ..." "2. ..." style.
  const matches = text.match(/(?:^|\s)(\d+\.\s+[^]+?)(?=\s+\d+\.\s+|\s*$)/g);
  if (matches && matches.length >= 2) {
    return matches.map((m) => m.replace(/^\s*\d+\.\s*/, "").trim());
  }
  return null;
}

function ReferencesTab({ plan, pending }: { plan: ExperimentPlan | null; pending: boolean }) {
  const refs = plan?.references ?? [];
  if (refs.length === 0)
    return (
      <EmptyOrSkeleton
        pending={pending}
        hint="Papers surfaced by the lit-QC stage appear here. Click any title to read the source."
      />
    );
  return (
    <div>
      <p
        className="mb-3 text-[11.5px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        These are the papers the lit-QC stage flagged as closest to the hypothesis.
        Use them to verify novelty and to anchor your protocol decisions.
      </p>
      <ul className="space-y-2">
        {refs.map((r, i) => {
          const href = r.url || (r.doi ? `https://doi.org/${r.doi}` : null);
          return (
            <li
              key={i}
              className="border p-3"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                borderRadius: 4,
              }}
            >
              <div className="text-[12.5px]" style={{ color: "var(--color-text)", lineHeight: 1.4 }}>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="content-link">
                    {r.title}
                  </a>
                ) : (
                  r.title
                )}
              </div>
              <div
                className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
                style={{ color: "var(--color-text-muted)" }}
              >
                <span>
                  {r.authors.slice(0, 4).join(", ")}
                  {r.authors.length > 4 ? " et al." : ""}
                </span>
                {r.year && (
                  <>
                    <span>·</span>
                    <span>{r.year}</span>
                  </>
                )}
                <span>·</span>
                <span style={{ color: "var(--color-accent)" }}>
                  {r.source.replace("_", " ")}
                </span>
                {typeof r.similarity === "number" && (
                  <>
                    <span>·</span>
                    <span className="tabular-nums">{(r.similarity * 100).toFixed(0)}% match</span>
                  </>
                )}
                {r.doi && (
                  <>
                    <span>·</span>
                    <a
                      href={`https://doi.org/${r.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="content-link font-mono"
                      style={{ fontSize: 10.5 }}
                    >
                      doi:{r.doi}
                    </a>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const tone = pct >= 75 ? "" : pct >= 50 ? "medium" : "low";
  return (
    <span title={`${pct}% confidence`} className="inline-flex items-center gap-1">
      <span className="confidence-meter">
        <span className={`fill ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[10.5px] font-mono" style={{ color: "var(--color-text-muted)" }}>
        {pct}%
      </span>
    </span>
  );
}

interface ExperimentFile {
  id: string;
  name: string;
  type: string | null;
  size: number | null;
  uploadedAt: string;
  url: string;
}

function FilesTab({ experimentId }: { experimentId: string | null }) {
  const [files, setFiles] = useState<ExperimentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!experimentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/experiments/${experimentId}/files`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { files: ExperimentFile[] };
      setFiles(data.files);
    } catch (err) {
      setError((err as Error).message ?? "failed to load");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      if (!experimentId) {
        setError("Run an experiment first — files attach to the current plan.");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/experiments/${experimentId}/files`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { file: ExperimentFile };
        setFiles((prev) => [data.file, ...prev]);
      } catch (err) {
        setError((err as Error).message ?? "upload failed");
      } finally {
        setUploading(false);
      }
    },
    [experimentId]
  );

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const handleDelete = async (fileId: string) => {
    if (!experimentId) return;
    if (!confirm("Remove this attachment?")) return;
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    try {
      const res = await fetch(`/api/experiments/${experimentId}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        await refresh();
      }
    } catch {
      await refresh();
    }
  };

  if (!experimentId) {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
        Run an experiment first — files attach to the current plan.
      </p>
    );
  }

  return (
    <div>
      <p
        className="mb-3 text-[11.5px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        Attach reference documents — protocols you found, prior datasets, image references,
        anything relevant. PDFs / images / CSVs / docs up to 4MB. These are saved alongside
        the experiment for the bench to download; they aren&rsquo;t fed back to the AI.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer border border-dashed p-6 text-center transition-colors"
        style={{
          background: dragOver
            ? "rgba(30, 64, 175, 0.06)"
            : "var(--color-surface)",
          borderColor: dragOver
            ? "var(--color-accent)"
            : "var(--color-border-strong)",
          borderRadius: 6,
          color: "var(--color-text-secondary)",
        }}
      >
        <div className="text-[12.5px]" style={{ fontWeight: 500 }}>
          {uploading ? "Uploading…" : "Drop a file here or click to choose"}
        </div>
        <div
          className="mt-1 text-[10.5px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          PDF · Word · Excel · CSV · TXT · MD · PNG · JPG (max 4MB)
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleSelect}
      />

      {error && (
        <div
          className="mt-2 border p-2 text-[11.5px]"
          style={{
            background: "rgba(185,28,28,0.06)",
            borderColor: "var(--color-error)",
            color: "var(--color-error)",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span
            className="text-[10.5px] font-semibold tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            ATTACHED ({files.length})
          </span>
          {loading && (
            <span
              className="text-[10.5px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              loading…
            </span>
          )}
        </div>
        {files.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            No files yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 border p-2.5"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  borderRadius: 4,
                }}
              >
                <FileTypeIcon type={f.type} />
                <div className="min-w-0 flex-1">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="content-link block truncate text-[12.5px]"
                    style={{ color: "var(--color-text)", fontWeight: 500 }}
                  >
                    {f.name}
                  </a>
                  <div
                    className="text-[10.5px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {formatFileSize(f.size)} ·{" "}
                    {new Date(f.uploadedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <button
                  onClick={() => void handleDelete(f.id)}
                  className="text-[10.5px]"
                  style={{ color: "var(--color-error)" }}
                  title="Remove attachment"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FileTypeIcon({ type }: { type: string | null }) {
  let label = "FILE";
  if (type) {
    if (type.includes("pdf")) label = "PDF";
    else if (type.includes("image")) label = "IMG";
    else if (type.includes("csv")) label = "CSV";
    else if (type.includes("word") || type.includes("officedocument.word")) label = "DOC";
    else if (type.includes("sheet") || type.includes("excel")) label = "XLS";
    else if (type.includes("json")) label = "JSON";
    else if (type.includes("markdown")) label = "MD";
    else if (type.includes("text")) label = "TXT";
  }
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center font-mono text-[9px]"
      style={{
        background: "var(--color-surface-alt)",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-border)",
        borderRadius: 3,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function formatFileSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function EmptyOrSkeleton({ pending, hint }: { pending: boolean; hint: string }) {
  if (pending) {
    return (
      <div className="space-y-2">
        <div className="skeleton h-16 w-full rounded" />
        <div className="skeleton h-16 w-full rounded" />
        <div className="skeleton h-16 w-full rounded" />
      </div>
    );
  }
  return (
    <p className="text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
      {hint}
    </p>
  );
}

// === Pipeline progress timeline ===
//
// A horizontal stepper rendered above the plan content while a run is
// in flight. Six stages, each shown as a labeled pill that goes from
// pending → active (pulsing) → done. Replaces the single-line status
// banner with something the user can actually use to gauge progress.

const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: "validating", label: "Validate" },
  { key: "classifying", label: "Classify" },
  { key: "lit_qc", label: "Literature" },
  { key: "generating", label: "Generate" },
  { key: "verifying", label: "Verify" },
  { key: "scoring", label: "Score" },
];

function PipelineProgress({
  status,
  stageMessage,
}: {
  status: string;
  stageMessage: string;
}) {
  const activeIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);
  return (
    <div
      className="shrink-0 border-b px-5 py-3"
      style={{
        background: "var(--color-info-box)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex items-center gap-1">
        {PIPELINE_STAGES.map((stage, i) => {
          const isDone = activeIndex > i;
          const isActive = activeIndex === i;
          // If we're past the last stage, mark all as done.
          const treatAsDone = activeIndex === -1 && status === "done" ? true : isDone;
          return (
            <div key={stage.key} className="flex flex-1 items-center gap-1.5">
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]"
                style={{
                  background: treatAsDone
                    ? "var(--color-accent)"
                    : isActive
                    ? "var(--color-accent)"
                    : "var(--color-surface-alt)",
                  color: treatAsDone || isActive ? "white" : "var(--color-text-muted)",
                  border: `1px solid ${
                    treatAsDone || isActive ? "var(--color-accent)" : "var(--color-border)"
                  }`,
                  animation: isActive
                    ? "pipeline-pulse 1.6s ease-in-out infinite"
                    : undefined,
                }}
              >
                {treatAsDone ? "✓" : i + 1}
              </span>
              <span
                className="truncate text-[10.5px]"
                style={{
                  color: isActive
                    ? "var(--color-text)"
                    : treatAsDone
                    ? "var(--color-text-secondary)"
                    : "var(--color-text-muted)",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {stage.label}
              </span>
              {i < PIPELINE_STAGES.length - 1 && (
                <span
                  className="h-px flex-1"
                  style={{
                    background: treatAsDone
                      ? "var(--color-accent)"
                      : "var(--color-border)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div
        className="mt-2 text-[11px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        {stageMessage || "Working…"}
      </div>
      <style jsx>{`
        @keyframes pipeline-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(30, 64, 175, 0.45); }
          50% { box-shadow: 0 0 0 6px rgba(30, 64, 175, 0); }
        }
      `}</style>
    </div>
  );
}
