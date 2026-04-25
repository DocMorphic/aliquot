"use client";

import { useState, useRef, useEffect } from "react";
import { useWindowManager } from "@/hooks/use-window-manager";
import { useModal } from "@/hooks/use-modal";
import { useExperiment } from "@/hooks/use-experiment";
import { STAGE_LABELS } from "@/lib/constants";
import { BrightnessPopover } from "./BrightnessPopover";

const RUNNING_STATUSES = new Set([
  "validating",
  "classifying",
  "lit_qc",
  "generating",
  "verifying",
  "scoring",
]);

const CMD_KEY =
  typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

function performReset() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("aliquot:"));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
  window.location.reload();
}

export function MenuBar() {
  const {
    openWindow,
    closeWindow,
    minimizeWindow,
    centerWindow,
    maximizeWindow,
    getFocusedAppId,
  } = useWindowManager();
  const { confirm } = useModal();
  const { status, stageMessage, sessionSpend, runsThisSession } = useExperiment();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleResetSystem = async () => {
    const ok = await confirm({
      title: "Reset System?",
      message:
        "Clears all local preferences (theme, accent, currency, pinned experiments) and reloads. Server-side data in Supabase is untouched.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) performReset();
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const focusedAppId = getFocusedAppId();
  const anyMenuOpen = openMenu === "bench" || openMenu === "experiment" || openMenu === "view";

  return (
    <div
      ref={menuRef}
      className="relative z-[600] flex h-[34px] items-stretch justify-between border-b pr-3"
      style={{
        background: "var(--color-menubar-bg)",
        borderColor: "var(--color-menubar-border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-stretch">
        {/* Logo — Aliquot pipette mark, mirrors app/icon.svg */}
        <div className="ml-3 mr-1 flex items-center">
          <div
            className="flex h-[18px] w-[18px] items-center justify-center"
            style={{ background: "var(--color-accent)", borderRadius: 4 }}
            aria-hidden
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="5" y="1.5" width="2" height="4.5" fill="white" />
              <path d="M5 6 L 4 7.5 L 8 7.5 L 7 6 Z" fill="white" />
              <path d="M6 8 C 4.7 9.6 4.7 10.6 6 10.6 C 7.3 10.6 7.3 9.6 6 8 Z" fill="white" />
            </svg>
          </div>
        </div>

        <MenuButton
          label="Aliquot"
          isOpen={openMenu === "bench"}
          onClick={() => setOpenMenu(openMenu === "bench" ? null : "bench")}
          onHoverOpen={() => setOpenMenu("bench")}
          anyMenuOpen={anyMenuOpen}
          className="ml-1"
          bold
        >
          <MenuItem
            label="About Aliquot"
            onClick={() => {
              openWindow("help");
              setOpenMenu(null);
            }}
          />
          <MenuDivider />
          <MenuItem
            label="Settings…"
            onClick={() => {
              openWindow("settings");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Reset System"
            onClick={() => {
              setOpenMenu(null);
              void handleResetSystem();
            }}
          />
        </MenuButton>

        <MenuButton
          label="Experiment"
          isOpen={openMenu === "experiment"}
          onClick={() => setOpenMenu(openMenu === "experiment" ? null : "experiment")}
          onHoverOpen={() => setOpenMenu("experiment")}
          anyMenuOpen={anyMenuOpen}
          className="ml-1"
        >
          <MenuItem
            label="New Experiment"
            shortcut={`${CMD_KEY}+N`}
            onClick={() => {
              openWindow("hypothesis");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Library"
            onClick={() => {
              openWindow("library");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Review Inbox"
            onClick={() => {
              openWindow("review");
              setOpenMenu(null);
            }}
          />
        </MenuButton>

        <MenuButton
          label="View"
          isOpen={openMenu === "view"}
          onClick={() => setOpenMenu(openMenu === "view" ? null : "view")}
          onHoverOpen={() => setOpenMenu("view")}
          anyMenuOpen={anyMenuOpen}
          className="ml-1"
        >
          <MenuItem
            label="Refresh"
            shortcut={`${CMD_KEY}+R`}
            onClick={() => window.location.reload()}
          />
          <MenuItem
            label="Maximize"
            onClick={() => {
              if (focusedAppId) maximizeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuItem
            label="Minimize"
            onClick={() => {
              if (focusedAppId) minimizeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuItem
            label="Close Window"
            onClick={() => {
              if (focusedAppId) closeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuDivider />
          <MenuItem
            label="Center Window"
            onClick={() => {
              if (focusedAppId) centerWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
        </MenuButton>
      </div>

      <div className="flex items-stretch gap-3">
        <PipelineStatus status={status} stageMessage={stageMessage} />

        <SessionSpend spend={sessionSpend} runs={runsThisSession} />

        <div className="relative flex items-center">
          <DisplayButton
            isOpen={openMenu === "brightness"}
            onClick={() => setOpenMenu(openMenu === "brightness" ? null : "brightness")}
          />
          {openMenu === "brightness" && (
            <BrightnessPopover onClose={() => setOpenMenu(null)} />
          )}
        </div>
      </div>
    </div>
  );
}

function MenuButton({
  label,
  isOpen,
  onClick,
  onHoverOpen,
  anyMenuOpen,
  className,
  bold,
  children,
}: {
  label: string;
  isOpen: boolean;
  onClick: () => void;
  onHoverOpen: () => void;
  anyMenuOpen: boolean;
  className?: string;
  bold?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const bg = isOpen
    ? "var(--color-menubar-active)"
    : hover
    ? "var(--color-menubar-hover)"
    : "transparent";
  return (
    <div className={`relative flex items-center ${className ?? ""}`}>
      <button
        className="rounded px-2.5 py-1 text-[12.5px] transition-colors"
        style={{
          background: bg,
          color: "var(--color-menubar-text)",
          fontWeight: bold ? 600 : 500,
        }}
        onMouseEnter={() => {
          setHover(true);
          if (anyMenuOpen && !isOpen) onHoverOpen();
        }}
        onMouseLeave={() => setHover(false)}
        onClick={onClick}
      >
        {label}
      </button>
      {isOpen && (
        <div
          className="menu-dropdown absolute left-0 top-full mt-1 min-w-[200px] border p-1"
          style={{
            background: "var(--color-surface-solid)",
            borderColor: "var(--color-border)",
            borderRadius: 6,
            boxShadow: "0 8px 24px var(--color-window-shadow)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[12px] transition-colors"
      style={{
        color: disabled ? "var(--color-text-dim)" : "var(--color-text)",
        cursor: disabled ? "default" : "pointer",
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--color-accent)";
          e.currentTarget.style.color = "#ffffff";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-text)";
        }
      }}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="ml-6 text-[10.5px] opacity-60">{shortcut}</span>
      )}
    </button>
  );
}

function MenuDivider() {
  return (
    <div
      className="mx-2 my-1 h-px"
      style={{ background: "var(--color-border)" }}
    />
  );
}

function DisplayButton({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = isOpen
    ? "var(--color-menubar-active)"
    : hover
    ? "var(--color-menubar-hover)"
    : "transparent";
  return (
    <button
      className="flex h-[24px] w-[24px] items-center justify-center rounded transition-colors"
      style={{ background: bg }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      aria-label="Display settings"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-menubar-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  );
}

function PipelineStatus({
  status,
  stageMessage,
}: {
  status: string;
  stageMessage: string;
}) {
  const running = RUNNING_STATUSES.has(status);
  const label = running
    ? stageMessage || STAGE_LABELS[status] || "Running"
    : status === "needs_refinement"
    ? "Needs refinement"
    : status === "failed"
    ? "Failed"
    : "Idle";
  return (
    <span
      className="flex items-center gap-1.5 text-[11.5px]"
      style={{ color: "var(--color-menubar-text)" }}
      title={running ? "Pipeline running" : "No experiment running"}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: running
            ? "var(--color-accent)"
            : status === "failed"
            ? "var(--color-error)"
            : "var(--color-text-dim)",
          animation: running ? "menu-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
      <span
        className="hidden truncate sm:inline-block"
        style={{ maxWidth: 220 }}
      >
        {label}
      </span>
      <style jsx>{`
        @keyframes menu-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </span>
  );
}

function SessionSpend({ spend, runs }: { spend: number; runs: number }) {
  const formatted = `$${spend.toFixed(2)}`;
  return (
    <span
      className="flex items-center gap-1 text-[11.5px] tabular-nums"
      style={{ color: "var(--color-menubar-text)" }}
      title={`API spend this session — local estimate, resets on reload. ${runs} run${
        runs === 1 ? "" : "s"
      } so far.`}
    >
      <span style={{ color: "var(--color-text-muted)" }}>session:</span>
      <span style={{ fontWeight: 500 }}>{formatted}</span>
    </span>
  );
}
