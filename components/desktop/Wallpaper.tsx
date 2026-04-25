"use client";

import { useTheme } from "@/hooks/use-theme";

/**
 * Bench OS wallpaper — clean paper-white in light mode, deep neutral in dark.
 * A subtle dot grid evokes engineering paper without the heavy notebook
 * texture. Kept intentionally minimal so windows are the focus.
 */
export function Wallpaper() {
  const { mode } = useTheme();
  const dotColor =
    mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(12, 10, 9, 0.05)";

  return (
    <div
      className="desktop-wallpaper"
      style={{ background: "var(--color-bg)" }}
    >
      {/* Dot grid — engineering paper feel */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${dotColor} 1px, transparent 1.2px)`,
          backgroundSize: "28px 28px",
        }}
      />
      {/* Subtle radial gradient for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            mode === "dark"
              ? "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)"
              : "radial-gradient(ellipse at center, transparent 70%, rgba(12,10,9,0.04) 100%)",
        }}
      />
    </div>
  );
}
