"use client";

import { useState } from "react";
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

type Tab = "protocol" | "materials" | "equipment" | "budget" | "timeline" | "validation";

const TABS: { id: Tab; label: string }[] = [
  { id: "protocol", label: "Protocol" },
  { id: "materials", label: "Materials" },
  { id: "equipment", label: "Equipment" },
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "validation", label: "Validation" },
];

export function PlanWindow() {
  const { plan, status, stageMessage, hypothesis, error } = useExperiment();
  const { openWindow } = useWindowManager();
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
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center justify-between px-3 py-1.5 text-left text-[12.5px] transition-colors"
            style={{
              background: tab === t.id ? "var(--color-accent)" : "transparent",
              color: tab === t.id ? "white" : "var(--color-text)",
            }}
            onMouseEnter={(e) => {
              if (tab !== t.id)
                e.currentTarget.style.background = "var(--color-surface-hover)";
            }}
            onMouseLeave={(e) => {
              if (tab !== t.id) e.currentTarget.style.background = "transparent";
            }}
          >
            <span>{t.label}</span>
          </button>
        ))}

        <div className="mt-auto p-3">
          <button
            onClick={() => openWindow("review")}
            disabled={!plan}
            className="w-full border px-2 py-1.5 text-[12px] transition-colors"
            style={{
              background: "transparent",
              borderColor: "var(--color-border)",
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
          <div
            className="shrink-0 border-b px-5 py-2.5 text-[11.5px]"
            style={{
              background: "var(--color-info-box)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <span
              className="mr-2 inline-block h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: "var(--color-accent)" }}
            />
            {stageMessage || STAGE_LABELS[status] || "Working…"}
          </div>
        )}

        {plan?.notes && status === "done" && (
          <div
            className="shrink-0 border-b px-5 py-2.5 text-[11.5px]"
            style={{
              background: "rgba(180, 83, 9, 0.08)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <span
              className="mr-2 font-semibold tracking-wider"
              style={{ color: "var(--color-warn)", fontSize: 10 }}
            >
              CAVEATS
            </span>
            <span style={{ lineHeight: 1.5 }}>{plan.notes}</span>
          </div>
        )}

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {tab === "protocol" && <ProtocolTab plan={plan} pending={isPending} />}
          {tab === "materials" && <MaterialsTab plan={plan} pending={isPending} />}
          {tab === "equipment" && <EquipmentTab plan={plan} pending={isPending} />}
          {tab === "budget" && <BudgetTab plan={plan} pending={isPending} />}
          {tab === "timeline" && <TimelineTab plan={plan} pending={isPending} />}
          {tab === "validation" && <ValidationTab plan={plan} pending={isPending} />}
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
  return (
    <div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr style={{ color: "var(--color-text-muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th className="pb-2 text-left font-semibold">Category</th>
            <th className="pb-2 text-left font-semibold">Item</th>
            <th className="pb-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {plan.budget.lines.map((l, i) => (
            <BudgetRow key={i} l={l} />
          ))}
        </tbody>
      </table>
      <div
        className="mt-4 flex items-center justify-between border-t pt-3 text-[14px]"
        style={{ borderColor: "var(--color-border-strong)", fontWeight: 600 }}
      >
        <span>Total</span>
        <span className="tabular-nums">
          {plan.budget.currency}
          {plan.budget.total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function BudgetRow({ l }: { l: BudgetLine }) {
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
        {l.currency}
        {l.amount.toLocaleString()}
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
