"use client";

import { useTheme } from "@/hooks/use-theme";

export function SettingsApp() {
  const { mode, toggleMode, brightness, setBrightness } = useTheme();

  return (
    <div className="flex flex-col gap-5 text-[13px]">
      <div>
        <h2 className="text-[16px]" style={{ fontWeight: 600 }}>
          Settings
        </h2>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
          Local preferences. Persisted in localStorage.
        </p>
      </div>

      <div>
        <div
          className="mb-2 text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          APPEARANCE
        </div>
        <div className="flex items-center justify-between">
          <span>Theme</span>
          <button
            onClick={toggleMode}
            className="border px-3 py-1 text-[12px] transition-colors"
            style={{
              background: "var(--color-surface-alt)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
              borderRadius: 4,
            }}
          >
            {mode === "dark" ? "🌙 Dark" : "☀️ Light"}
          </button>
        </div>
      </div>

      <div>
        <div
          className="mb-2 text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          DISPLAY BRIGHTNESS
        </div>
        <input
          type="range"
          min={70}
          max={100}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--color-accent)" }}
        />
        <div
          className="mt-1 flex justify-between text-[10.5px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>Dim</span>
          <span>{brightness}%</span>
          <span>Bright</span>
        </div>
      </div>

      <div
        className="mt-auto border-t pt-3 text-[11px]"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
      >
        Bench OS · Hack-Nation × Fulcrum Science
      </div>
    </div>
  );
}
