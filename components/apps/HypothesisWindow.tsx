"use client";

import { useEffect, useRef, useState } from "react";
import { useExperiment } from "@/hooks/use-experiment";
import { useTheme } from "@/hooks/use-theme";
import { useWindowManager } from "@/hooks/use-window-manager";
import { SAMPLE_HYPOTHESES } from "@/content/sample-hypotheses";

export function HypothesisWindow() {
  const {
    runExperiment,
    status,
    hypothesis: activeHypothesis,
    refinement,
    confirmation,
    error,
  } = useExperiment();
  const { currency } = useTheme();
  const { openWindow } = useWindowManager();
  const [text, setText] = useState("");

  const isRunning =
    status !== "queued" &&
    status !== "done" &&
    status !== "failed" &&
    status !== "needs_refinement" &&
    status !== "needs_confirmation";
  const showRefinement = status === "needs_refinement" && refinement !== null;
  const showConfirmation = status === "needs_confirmation" && confirmation !== null;
  const showError = status === "failed" && !!error;

  // Clear the textarea once the plan is fully delivered so the next
  // hypothesis starts from a blank slate. Track the previous status
  // via a ref to avoid clearing on every "done" render.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== "done" && status === "done") {
      setText("");
    }
    prevStatusRef.current = status;
  }, [status]);

  async function handleRun(submitted: string) {
    const value = submitted.trim();
    if (!value || isRunning) return;
    openWindow("lit-qc");
    openWindow("plan");
    await runExperiment(value, { currency });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2
          className="text-[18px]"
          style={{ fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          What scientific question do you want to test?
        </h2>
        <p
          className="mt-1 text-[12.5px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          State a specific intervention, a measurable outcome with a threshold, a mechanism, and an implied control.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes…"
        className="w-full resize-none border p-3 text-[13px] outline-none transition-colors"
        style={{
          background: "var(--color-input-bg)",
          borderColor: showRefinement ? "var(--color-warn)" : "var(--color-input-border)",
          color: "var(--color-text)",
          borderRadius: 6,
          minHeight: 120,
          fontFamily: "inherit",
        }}
        rows={6}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void handleRun(text);
          }
        }}
      />

      {showError && (
        <div
          className="border p-3"
          style={{
            background: "rgba(185, 28, 28, 0.06)",
            borderColor: "var(--color-error)",
            borderRadius: 6,
          }}
        >
          <div
            className="text-[10.5px] font-semibold tracking-wider"
            style={{ color: "var(--color-error)" }}
          >
            PIPELINE FAILED
          </div>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: "var(--color-text)", lineHeight: 1.5 }}
          >
            {error}
          </p>
          <p
            className="mt-2 text-[11.5px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Edit and re-run, or simplify the hypothesis (fewer reagents = faster generation).
          </p>
        </div>
      )}

      {showConfirmation && confirmation && (
        <div
          className="border p-3"
          style={{
            background: "rgba(30, 64, 175, 0.06)",
            borderColor: "var(--color-accent)",
            borderRadius: 6,
          }}
        >
          <div
            className="text-[10.5px] font-semibold tracking-wider"
            style={{ color: "var(--color-accent)" }}
          >
            DID YOU MEAN THIS?
          </div>
          <p
            className="mt-1 text-[11.5px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {confirmation.reason}
          </p>
          <div
            className="mt-2 border p-2.5 text-[12.5px]"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
              borderRadius: 4,
              lineHeight: 1.5,
            }}
          >
            {confirmation.refined}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                openWindow("lit-qc");
                openWindow("plan");
                void runExperiment(confirmation.refined, { currency });
              }}
              className="px-3 py-1 text-[11.5px] font-medium transition-colors"
              style={{
                background: "var(--color-accent)",
                color: "white",
                borderRadius: 4,
              }}
            >
              Yes, run this
            </button>
            <button
              onClick={() => setText(confirmation.refined)}
              className="border px-3 py-1 text-[11.5px] transition-colors"
              style={{
                background: "var(--color-surface-alt)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                borderRadius: 4,
              }}
            >
              Edit it
            </button>
            <button
              onClick={() => {
                openWindow("lit-qc");
                openWindow("plan");
                void runExperiment(confirmation.original, { currency });
              }}
              className="border px-3 py-1 text-[11.5px] transition-colors"
              style={{
                background: "transparent",
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                borderRadius: 4,
              }}
              title="Run my exact wording, even though it's informal"
            >
              No, run as-is
            </button>
          </div>
        </div>
      )}

      {showRefinement && refinement && (
        <div
          className="border p-3"
          style={{
            background: "rgba(180, 83, 9, 0.06)",
            borderColor: "var(--color-warn)",
            borderRadius: 6,
          }}
        >
          <div
            className="text-[10.5px] font-semibold tracking-wider"
            style={{ color: "var(--color-warn)" }}
          >
            REFINE YOUR HYPOTHESIS
          </div>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}
          >
            {refinement.reason}
          </p>
          {refinement.suggestions.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              <div
                className="text-[10.5px] font-semibold tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                TRY ONE OF THESE
              </div>
              {refinement.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setText(s)}
                  className="block w-full border p-2 text-left text-[12px] transition-colors"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                    borderRadius: 4,
                    lineHeight: 1.5,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <div
          className="mb-2 text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          QUICK START — SAMPLE HYPOTHESES
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_HYPOTHESES.map((s) => (
            <button
              key={s.id}
              className="border px-2.5 py-1 text-[11.5px] transition-colors"
              style={{
                background: "var(--color-surface-alt)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent)";
                e.currentTarget.style.color = "var(--color-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
              onClick={() => setText(s.hypothesis)}
              title={s.plainEnglish}
            >
              <span style={{ color: "var(--color-text-muted)", marginRight: 6, fontSize: 10.5 }}>
                {s.domain}
              </span>
              {s.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mt-auto flex items-center justify-between border-t pt-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
          {isRunning ? (
            <>
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
              Running… edit and re-run anytime.
            </>
          ) : showRefinement ? (
            <>Pick a refined hypothesis above, or edit and try again.</>
          ) : activeHypothesis ? (
            <>Done. Edit and submit again to re-run.</>
          ) : (
            <>Tip: ⌘+Enter to run · Currency: {currency}</>
          )}
        </div>
        <button
          onClick={() => void handleRun(text)}
          disabled={!text.trim() || isRunning}
          className="px-4 py-1.5 text-[12.5px] font-medium transition-colors"
          style={{
            background: !text.trim() || isRunning ? "var(--color-surface-alt)" : "var(--color-accent)",
            color: !text.trim() || isRunning ? "var(--color-text-dim)" : "white",
            borderRadius: 4,
            cursor: !text.trim() || isRunning ? "not-allowed" : "pointer",
          }}
        >
          {isRunning ? "Running…" : "Run"}
        </button>
      </div>
    </div>
  );
}
