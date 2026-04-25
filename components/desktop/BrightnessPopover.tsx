"use client";

import { useTheme } from "@/hooks/use-theme";
import { useWindowManager } from "@/hooks/use-window-manager";

interface BrightnessPopoverProps {
  onClose: () => void;
}

export function BrightnessPopover({ onClose }: BrightnessPopoverProps) {
  const { brightness, setBrightness, mode, toggleMode } = useTheme();
  const { openWindow } = useWindowManager();

  return (
    <div
      className="menu-dropdown absolute right-0 top-full mt-1 w-[230px] border p-3"
      style={{
        background: "var(--color-surface-solid)",
        borderColor: "var(--color-border)",
        borderRadius: 8,
        boxShadow: "0 8px 24px var(--color-window-shadow)",
      }}
    >
      <div
        className="mb-2 text-[10px] font-semibold tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        DISPLAY
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-[12px]" style={{ color: "var(--color-text)" }}>
          Brightness
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
          className="mt-1 flex justify-between text-[10px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>Dim</span>
          <span>{brightness}%</span>
          <span>Bright</span>
        </div>
      </div>

      <div className="my-2 h-px" style={{ background: "var(--color-border)" }} />

      <button
        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[12px] transition-colors"
        style={{ color: "var(--color-text)" }}
        onClick={toggleMode}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <span>{mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}</span>
        <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>
          {mode === "dark" ? "DARK" : "LIGHT"}
        </span>
      </button>

      <button
        className="mt-0.5 w-full rounded px-2 py-1.5 text-left text-[12px] transition-colors"
        style={{ color: "var(--color-text)" }}
        onClick={() => {
          openWindow("settings");
          onClose();
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        Open settings…
      </button>
    </div>
  );
}
