"use client";

import { useCallback, useEffect, useState } from "react";
import { useModal } from "@/hooks/use-modal";
import type { CorrectionRecord } from "@/lib/supabase/corrections";

export function GuidelinesApp() {
  const { confirm } = useModal();
  const [guidelines, setGuidelines] = useState<CorrectionRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/guidelines", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { guidelines: CorrectionRecord[] };
      setGuidelines(data.guidelines);
    } catch (err) {
      setLoadError((err as Error).message ?? "Failed to load");
      setGuidelines([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (g: CorrectionRecord) => {
      const ok = await confirm({
        title: "Remove this guideline?",
        message: (
          <>
            <div style={{ fontStyle: "italic", marginBottom: 8 }}>
              &ldquo;{g.corrected.length > 200 ? g.corrected.slice(0, 200) + "…" : g.corrected}&rdquo;
            </div>
            <div>
              Future {g.domain} plans will no longer reflect this. Cannot be undone.
            </div>
          </>
        ),
        confirmLabel: "Remove",
        cancelLabel: "Cancel",
        danger: true,
      });
      if (!ok) return;
      setGuidelines((prev) => prev?.filter((x) => x.id !== g.id) ?? prev);
      try {
        const res = await fetch(`/api/guidelines/${g.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setLoadError(`Delete failed: ${(err as Error).message}`);
        void load();
      }
    },
    [confirm, load]
  );

  // Group by domain so the user sees biology / chemistry / etc. separately.
  const grouped =
    guidelines === null
      ? null
      : guidelines.reduce<Record<string, CorrectionRecord[]>>((acc, g) => {
          (acc[g.domain] ??= []).push(g);
          return acc;
        }, {});

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-[14px]" style={{ fontWeight: 600 }}>
            Guidelines
          </h3>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
            Domain-wide rules the generator applies to every future plan. Review and remove anything that&apos;s gone stale.
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
          {loadError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {grouped === null ? (
          <div className="space-y-2">
            <div className="skeleton h-16 w-full rounded" />
            <div className="skeleton h-16 w-full rounded" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-1 text-center"
            style={{ color: "var(--color-text-muted)" }}
          >
            <div className="text-[12.5px]">No guidelines saved yet.</div>
            <div className="text-[11px]">
              In Scientist Review, choose &ldquo;General guideline&rdquo; to add one.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([domain, list]) => (
              <DomainGroup
                key={domain}
                domain={domain}
                items={list}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DomainGroup({
  domain,
  items,
  onDelete,
}: {
  domain: string;
  items: CorrectionRecord[];
  onDelete: (g: CorrectionRecord) => void;
}) {
  return (
    <div>
      <div
        className="mb-1.5 flex items-baseline gap-2 text-[10.5px] font-semibold tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span style={{ color: "var(--color-accent)" }}>{domain.toUpperCase()}</span>
        <span>·</span>
        <span>{items.length} guideline{items.length === 1 ? "" : "s"}</span>
      </div>
      <ul className="space-y-2">
        {items.map((g) => (
          <li
            key={g.id}
            className="border p-2.5"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              borderRadius: 4,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div
                  className="text-[10px] font-semibold tracking-wider"
                  style={{ color: "var(--color-text-muted)", marginBottom: 4 }}
                >
                  {g.section_path.toUpperCase()}
                </div>
                <div
                  className="text-[12px]"
                  style={{ color: "var(--color-text)", lineHeight: 1.5 }}
                >
                  {g.corrected}
                </div>
                {g.original && (
                  <div
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Was: <span style={{ fontStyle: "italic" }}>{g.original}</span>
                  </div>
                )}
                {g.rationale && (
                  <div
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Why: {g.rationale}
                  </div>
                )}
                <div
                  className="mt-1.5 flex items-center gap-2 text-[10.5px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span>severity {g.rating ?? "—"}/5</span>
                  <span>·</span>
                  <span>
                    {new Date(g.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onDelete(g)}
                className="shrink-0 border px-2 py-0.5 text-[10.5px] transition-colors"
                style={{
                  background: "var(--color-surface-alt)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-error)",
                  borderRadius: 3,
                }}
                title="Remove this guideline"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
