"use client";

import { useState } from "react";
import { useExperiment } from "@/hooks/use-experiment";

interface CorrectionDraft {
  sectionPath: string;
  original: string;
  corrected: string;
  rationale: string;
  rating: number;
}

const SECTION_OPTIONS = [
  { value: "protocol", label: "Protocol step" },
  { value: "materials", label: "Material / catalog #" },
  { value: "budget", label: "Budget line" },
  { value: "timeline", label: "Timeline phase" },
  { value: "validation", label: "Validation method" },
];

export function ReviewWindow() {
  const { plan, experimentId, hypothesis } = useExperiment();
  const [drafts, setDrafts] = useState<CorrectionDraft[]>([
    { sectionPath: "protocol", original: "", corrected: "", rationale: "", rating: 4 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  if (!plan || !hypothesis) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          Generate a plan first, then come back here to leave corrections.
        </p>
      </div>
    );
  }

  const updateDraft = (i: number, patch: Partial<CorrectionDraft>) => {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const addDraft = () => {
    setDrafts((prev) => [
      ...prev,
      { sectionPath: "protocol", original: "", corrected: "", rationale: "", rating: 4 },
    ]);
  };

  const removeDraft = (i: number) => {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!plan || submitting) return;
    const valid = drafts.filter((d) => d.corrected.trim().length > 0);
    if (valid.length === 0) return;

    setSubmitting(true);
    setConfirmation(null);
    try {
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId,
          domain: plan.domain,
          corrections: valid,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfirmation("Saved. Next plan in this domain will incorporate your feedback.");
      setDrafts([
        { sectionPath: "protocol", original: "", corrected: "", rationale: "", rating: 4 },
      ]);
    } catch (err) {
      setConfirmation(`Failed to save: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h3 className="text-[14px]" style={{ fontWeight: 600 }}>
          Scientist Review
        </h3>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
          Your corrections train the system. The next plan in domain{" "}
          <span style={{ color: "var(--color-accent)" }}>{plan.domain}</span> will reflect them.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
        {drafts.map((d, i) => (
          <div
            key={i}
            className="border p-2.5"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: 4,
            }}
          >
            <div className="flex items-center justify-between">
              <select
                value={d.sectionPath}
                onChange={(e) => updateDraft(i, { sectionPath: e.target.value })}
                className="text-[11.5px] outline-none"
                style={{
                  background: "var(--color-input-bg)",
                  border: "1px solid var(--color-input-border)",
                  color: "var(--color-text)",
                  borderRadius: 4,
                  padding: "2px 6px",
                }}
              >
                {SECTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeDraft(i)}
                className="text-[10.5px]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Remove
              </button>
            </div>

            <textarea
              value={d.original}
              onChange={(e) => updateDraft(i, { original: e.target.value })}
              placeholder="What was wrong (optional, paste from plan)…"
              className="mt-2 w-full resize-none border px-2 py-1.5 text-[11.5px] outline-none"
              style={{
                background: "var(--color-input-bg)",
                borderColor: "var(--color-input-border)",
                color: "var(--color-text)",
                borderRadius: 3,
                minHeight: 36,
              }}
              rows={2}
            />
            <textarea
              value={d.corrected}
              onChange={(e) => updateDraft(i, { corrected: e.target.value })}
              placeholder="The correction…"
              className="mt-1.5 w-full resize-none border px-2 py-1.5 text-[11.5px] outline-none"
              style={{
                background: "var(--color-input-bg)",
                borderColor: "var(--color-input-border)",
                color: "var(--color-text)",
                borderRadius: 3,
                minHeight: 36,
              }}
              rows={2}
            />
            <textarea
              value={d.rationale}
              onChange={(e) => updateDraft(i, { rationale: e.target.value })}
              placeholder="Why this is the right correction (optional)…"
              className="mt-1.5 w-full resize-none border px-2 py-1.5 text-[11.5px] outline-none"
              style={{
                background: "var(--color-input-bg)",
                borderColor: "var(--color-input-border)",
                color: "var(--color-text)",
                borderRadius: 3,
                minHeight: 30,
              }}
              rows={2}
            />

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10.5px]" style={{ color: "var(--color-text-muted)" }}>
                Severity / confidence
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => updateDraft(i, { rating: n })}
                    className="h-5 w-5 text-[11px]"
                    style={{
                      background: n <= d.rating ? "var(--color-accent)" : "var(--color-surface-alt)",
                      color: n <= d.rating ? "white" : "var(--color-text-muted)",
                      borderRadius: 3,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addDraft}
          className="w-full border border-dashed py-1.5 text-[11.5px] transition-colors"
          style={{
            borderColor: "var(--color-border-strong)",
            color: "var(--color-text-muted)",
            borderRadius: 4,
          }}
        >
          + Add another correction
        </button>
      </div>

      {confirmation && (
        <div
          className="text-[11px]"
          style={{ color: "var(--color-success)" }}
        >
          {confirmation}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || drafts.every((d) => !d.corrected.trim())}
        className="px-4 py-2 text-[12.5px] font-medium transition-colors"
        style={{
          background: submitting ? "var(--color-surface-alt)" : "var(--color-accent)",
          color: submitting ? "var(--color-text-dim)" : "white",
          borderRadius: 4,
        }}
      >
        {submitting ? "Saving…" : "Save corrections"}
      </button>
    </div>
  );
}
