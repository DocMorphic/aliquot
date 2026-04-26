"use client";

import { useEffect, useState } from "react";

const TOTAL_DURATION_MS = 1700;
const FADE_OUT_DELAY_MS = 1400;

/**
 * Boot screen — animated pipette drop sequence.
 *
 * Visual story (~1.7s total):
 *   1. Dark lab background fades in instantly.
 *   2. A pipette stem draws itself in (top → bottom) using SVG
 *      stroke-dasharray animation.
 *   3. A liquid bulb fills inside the pipette, then a single drop
 *      detaches and falls.
 *   4. The drop lands, ripples expand outward over a faint surface
 *      line.
 *   5. The Aliquot wordmark fades in beside the ripple.
 *   6. Whole screen fades out.
 *
 * No external assets — everything is inline SVG so it loads
 * instantly with no FOUC. The screen unmounts after the fade-out
 * completes so it doesn't intercept clicks afterwards.
 */
export function BootScreen() {
  const [unmounted, setUnmounted] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), FADE_OUT_DELAY_MS);
    const t2 = setTimeout(() => setUnmounted(true), TOTAL_DURATION_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (unmounted) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "#0c0a09",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.3s ease-in",
        pointerEvents: fadeOut ? "none" : "auto",
      }}
      aria-live="polite"
      aria-label="Loading workspace"
    >
      {/* Single SVG canvas — pipette + drop + surface + ripples */}
      <div className="flex flex-col items-center gap-5">
        <svg
          width="120"
          height="180"
          viewBox="0 0 120 180"
          fill="none"
          aria-hidden
        >
          {/* Pipette outer stroke — draws itself in (0 → 1.0) */}
          <path
            d="M 51 12 L 69 12 M 51 12 L 51 95 Q 51 100 53 102 L 60 130 L 67 102 Q 69 100 69 95 L 69 12"
            stroke="#60a5fa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{
              strokeDasharray: 320,
              strokeDashoffset: 320,
              animation: "draw 0.55s ease-out 0.1s forwards",
            }}
          />
          {/* Liquid bulb fills in after the stroke completes */}
          <path
            d="M 53 70 L 53 95 Q 53 99 54.5 101 L 60 122 L 65.5 101 Q 67 99 67 95 L 67 70 Z"
            fill="#1E40AF"
            style={{
              transformOrigin: "60px 122px",
              transform: "scaleY(0)",
              animation: "fill 0.45s ease-out 0.55s forwards",
            }}
          />
          {/* Falling drop — emerges at the tip, drops to the surface */}
          <ellipse
            cx="60"
            cy="132"
            rx="3.5"
            ry="4.5"
            fill="#60a5fa"
            style={{
              opacity: 0,
              animation: "drop 0.6s cubic-bezier(0.4, 0, 0.7, 1) 1s forwards",
            }}
          />
          {/* Surface line */}
          <line
            x1="20"
            y1="156"
            x2="100"
            y2="156"
            stroke="#3b3a39"
            strokeWidth="1"
            style={{
              strokeDasharray: 80,
              strokeDashoffset: 80,
              animation: "draw 0.4s ease-out 0.9s forwards",
            }}
          />
          {/* Ripples — three concentric circles fade out as they expand */}
          {[0, 0.12, 0.24].map((delay, i) => (
            <circle
              key={i}
              cx="60"
              cy="156"
              r="2"
              stroke="#60a5fa"
              strokeWidth="1.2"
              fill="none"
              style={{
                opacity: 0,
                animation: `ripple 0.7s ease-out ${1.4 + delay}s forwards`,
              }}
            />
          ))}
        </svg>

        <div
          className="flex flex-col items-center gap-1.5"
          style={{
            opacity: 0,
            animation: "wordmark-in 0.45s ease-out 1.15s forwards",
          }}
        >
          <div
            className="font-display text-[28px]"
            style={{
              color: "#fafaf9",
              fontWeight: 500,
              letterSpacing: "-0.02em",
            }}
          >
            Aliquot
          </div>
          <div
            className="text-[10.5px] uppercase tracking-[0.18em]"
            style={{ color: "#78716c" }}
          >
            The AI Scientist
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fill {
          to { transform: scaleY(1); }
        }
        @keyframes drop {
          0%   { opacity: 0; transform: translate(0, 0) scaleY(0.6); }
          15%  { opacity: 1; transform: translate(0, 0) scaleY(1); }
          100% { opacity: 1; transform: translate(0, 24px) scaleY(1.3); }
        }
        @keyframes ripple {
          0%   { opacity: 0.6; r: 2; }
          100% { opacity: 0; r: 30; }
        }
        @keyframes wordmark-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
