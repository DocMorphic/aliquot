"use client";

import { useState, useEffect } from "react";

const BOOT_LINES = [
  "loading kernel ............ ok",
  "mounting /experiments ..... ok",
  "starting window manager ... ok",
  "initializing pipeline ..... ok",
  "aliquot@lab:~$ ready",
];

const LINE_STAGGER_MS = 120;
const FADE_DELAY_MS = BOOT_LINES.length * LINE_STAGGER_MS + 400;

export function BootScreen() {
  const [visible, setVisible] = useState(true);
  const [linesShown, setLinesShown] = useState(0);

  useEffect(() => {
    const lineTimers = BOOT_LINES.map((_, i) =>
      setTimeout(() => setLinesShown(i + 1), i * LINE_STAGGER_MS + 100)
    );
    const unmountTimer = setTimeout(() => setVisible(false), FADE_DELAY_MS + 500);
    return () => {
      lineTimers.forEach(clearTimeout);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="boot-screen fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ background: "#0c0a09" }}
      aria-live="polite"
      aria-label="Loading workspace"
    >
      <div className="flex flex-col items-start gap-1 font-mono text-[13px]" style={{ color: "#a8a29e" }}>
        <div
          className="font-display mb-4 text-[22px]"
          style={{ color: "#fafaf9", fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          Aliquot
          <span style={{ color: "#60a5fa", marginLeft: 10, fontFamily: "system-ui" }}>·</span>
          <span
            style={{ color: "#78716c", marginLeft: 10, fontFamily: "system-ui", fontSize: 13 }}
          >
            The AI Scientist
          </span>
        </div>
        {BOOT_LINES.map((line, i) => {
          const shown = i < linesShown;
          return (
            <div
              key={i}
              className="flex items-start"
              style={{
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(2px)",
                transition: "opacity 0.15s ease-out, transform 0.15s ease-out",
              }}
            >
              <span style={{ color: "#60a5fa", marginRight: 8 }}>›</span>
              <span>{line}</span>
              {i === BOOT_LINES.length - 1 && shown && (
                <span className="cursor-blink ml-1" style={{ color: "#60a5fa" }}>
                  ▍
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
