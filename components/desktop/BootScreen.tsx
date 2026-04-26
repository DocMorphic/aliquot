"use client";

import { useEffect, useState } from "react";

const TOTAL_DURATION_MS = 900;
const FADE_OUT_DELAY_MS = 600;

/**
 * Boot screen — a clean centered wordmark + tagline that fades in,
 * holds briefly, then fades out. Replaces the previous terminal-style
 * scrolling boot lines (dark + busy) with something quieter and
 * on-brand. Total time on screen ~900ms.
 */
export function BootScreen() {
  const [stage, setStage] = useState<"in" | "hold" | "out" | "gone">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setStage("hold"), 180);
    const t2 = setTimeout(() => setStage("out"), FADE_OUT_DELAY_MS);
    const t3 = setTimeout(() => setStage("gone"), TOTAL_DURATION_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (stage === "gone") return null;

  const opacity = stage === "in" ? 0 : stage === "out" ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "var(--color-bg)",
        opacity,
        transition:
          stage === "in"
            ? "opacity 0.3s ease-out"
            : stage === "out"
            ? "opacity 0.3s ease-in"
            : "none",
        pointerEvents: stage === "out" ? "none" : "auto",
      }}
      aria-live="polite"
      aria-label="Loading workspace"
    >
      <div className="flex flex-col items-center gap-3">
        {/* Pipette mark — same as the favicon, larger */}
        <div
          className="flex h-14 w-14 items-center justify-center"
          style={{
            background: "var(--color-accent)",
            borderRadius: 14,
            transform: stage === "in" ? "scale(0.9)" : "scale(1)",
            transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          aria-hidden
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="13.5" y="5.5" width="5" height="2" rx="0.5" fill="#fff" />
            <rect x="14.25" y="7.5" width="3.5" height="11.5" fill="#fff" />
            <path d="M14.25 19 L13 22 L19 22 L17.75 19 Z" fill="#fff" />
            <path
              d="M16 23.5 C 13.5 26 13.5 28.5 16 28.5 C 18.5 28.5 18.5 26 16 23.5 Z"
              fill="#fff"
            />
          </svg>
        </div>
        {/* Wordmark in Fraunces */}
        <div
          className="font-display text-[34px]"
          style={{
            color: "var(--color-text)",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            transform: stage === "in" ? "translateY(6px)" : "translateY(0)",
            transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          Aliquot
        </div>
        <div
          className="text-[12px]"
          style={{
            color: "var(--color-text-muted)",
            letterSpacing: "0.04em",
          }}
        >
          The AI Scientist
        </div>
      </div>
    </div>
  );
}
