"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowManager } from "@/hooks/use-window-manager";
import { useExperiment } from "@/hooks/use-experiment";
import { useDesktopPins, type PinnedExperiment } from "@/hooks/use-desktop-pins";
import { useModal } from "@/hooks/use-modal";

const MOBILE_BREAKPOINT = 768;
const ICON_WIDTH = 92;
const ICON_HEIGHT = 88;
const DRAG_THRESHOLD_PX = 6;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

interface IconPos {
  x: number;
  y: number;
}

interface DesktopItem {
  id: string;
  label: string;
  type: "folder" | "app" | "doc";
  appId?: string;
}

const DESKTOP_ITEMS: DesktopItem[] = [
  { id: "experiments", label: "experiments", type: "folder", appId: "library" },
  { id: "new-experiment", label: "New Experiment", type: "app", appId: "hypothesis" },
  { id: "guide", label: "guide.md", type: "doc", appId: "help" },
];

const DEFAULT_POSITIONS: Record<string, IconPos> = {
  experiments: { x: 24, y: 24 },
  "new-experiment": { x: 24, y: 124 },
  guide: { x: 24, y: 224 },
};

function clampPosition(x: number, y: number): IconPos {
  if (typeof window === "undefined") return { x, y };
  const vw = window.innerWidth;
  const contentH = window.innerHeight - 34;
  const dockReserve = 80;
  const minX = 0;
  const maxX = Math.max(minX, vw - ICON_WIDTH);
  const minY = 0;
  const maxY = Math.max(minY, contentH - ICON_HEIGHT - dockReserve);
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

interface DesktopIconsProps {
  onToast?: (message: string) => void;
}

export function DesktopIcons({}: DesktopIconsProps) {
  const { openWindow, focusWindow } = useWindowManager();
  const { loadFromHistory } = useExperiment();
  const { pinned, unpin, move } = useDesktopPins();
  const { confirm } = useModal();
  const isMobile = useIsMobile();
  const [positions, setPositions] = useState<Record<string, IconPos>>(DEFAULT_POSITIONS);

  const handleActivate = useCallback(
    (item: DesktopItem) => {
      if (item.appId) openWindow(item.appId);
    },
    [openWindow]
  );

  const handlePinnedActivate = useCallback(
    async (p: PinnedExperiment) => {
      const ok = await loadFromHistory(p.experimentId);
      if (ok) {
        openWindow("plan");
        focusWindow("plan");
        openWindow("lit-qc");
      }
    },
    [loadFromHistory, openWindow, focusWindow]
  );

  const handleUnpin = useCallback(
    async (p: PinnedExperiment) => {
      const ok = await confirm({
        title: "Remove from desktop?",
        message:
          "This only removes the desktop shortcut. The experiment stays in your Library and Supabase.",
        confirmLabel: "Remove",
        cancelLabel: "Keep",
      });
      if (ok) unpin(p.experimentId);
    },
    [confirm, unpin]
  );

  if (isMobile) {
    return (
      <div
        className="no-scrollbar absolute left-0 right-0 top-0 z-[5] overflow-x-auto overflow-y-hidden"
        style={{ WebkitOverflowScrolling: "touch", maxWidth: "100vw" }}
      >
        <div className="flex w-max items-start gap-2 px-3 py-3">
          {DESKTOP_ITEMS.map((item) => (
            <button
              key={item.id}
              className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 rounded-lg px-1 py-1 select-none"
              onClick={() => handleActivate(item)}
            >
              <DesktopIconSvg type={item.type} size={48} />
              <span
                className="w-full truncate text-center text-[11.5px]"
                style={{ color: "var(--color-desktop-label)", fontWeight: 500 }}
              >
                {item.label}
              </span>
            </button>
          ))}
          {pinned.map((p) => (
            <button
              key={p.experimentId}
              className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 rounded-lg px-1 py-1 select-none"
              onClick={() => void handlePinnedActivate(p)}
            >
              <PinnedIconSvg size={48} />
              <span
                className="w-full truncate text-center text-[11.5px]"
                style={{ color: "var(--color-desktop-label)", fontWeight: 500 }}
              >
                {pinnedLabel(p)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {DESKTOP_ITEMS.map((item) => (
        <DraggableIcon
          key={item.id}
          item={item}
          position={positions[item.id] ?? DEFAULT_POSITIONS[item.id]}
          onOpen={() => handleActivate(item)}
          onCommit={(x, y) => {
            setPositions((prev) => ({
              ...prev,
              [item.id]: clampPosition(x, y),
            }));
          }}
        />
      ))}
      {pinned.map((p) => (
        <PinnedIcon
          key={p.experimentId}
          pin={p}
          onOpen={() => void handlePinnedActivate(p)}
          onUnpin={() => void handleUnpin(p)}
          onCommit={(x, y) => {
            const c = clampPosition(x, y);
            move(p.experimentId, c.x, c.y);
          }}
        />
      ))}
    </>
  );
}

function pinnedLabel(p: PinnedExperiment): string {
  const t = p.hypothesis.trim();
  if (t.length <= 28) return t;
  return t.slice(0, 25) + "…";
}

interface DraggableIconProps {
  item: DesktopItem;
  position: IconPos;
  onOpen: () => void;
  onCommit: (x: number, y: number) => void;
}

function DraggableIcon({ item, position, onOpen, onCommit }: DraggableIconProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    pointerStartX: 0,
    pointerStartY: 0,
    baseX: 0,
    baseY: 0,
    latestX: 0,
    latestY: 0,
    dragging: false,
    moved: false,
    rafPending: false,
  });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const s = dragState.current;
      s.pointerStartX = e.clientX;
      s.pointerStartY = e.clientY;
      s.baseX = position.x;
      s.baseY = position.y;
      s.latestX = position.x;
      s.latestY = position.y;
      s.dragging = true;
      s.moved = false;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    [position.x, position.y]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.pointerStartX;
    const dy = e.clientY - s.pointerStartY;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      s.moved = true;
      rootRef.current?.classList.add("dragging");
    }
    s.latestX = s.baseX + dx;
    s.latestY = s.baseY + dy;
    if (!s.rafPending) {
      s.rafPending = true;
      requestAnimationFrame(() => {
        s.rafPending = false;
        const el = rootRef.current;
        if (el) {
          el.style.transform = `translate3d(${s.latestX}px, ${s.latestY}px, 0)`;
        }
      });
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = dragState.current;
      if (!s.dragging) return;
      s.dragging = false;
      try {
        if (e.currentTarget && "releasePointerCapture" in e.currentTarget) {
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        }
      } catch {}
      rootRef.current?.classList.remove("dragging");
      if (!s.moved) {
        onOpen();
        return;
      }
      onCommit(s.latestX, s.latestY);
    },
    [onCommit, onOpen]
  );

  return (
    <div
      ref={rootRef}
      className="desktop-icon absolute z-10 flex flex-col items-center gap-1 px-2 py-2 select-none"
      style={{
        left: 0,
        top: 0,
        width: ICON_WIDTH,
        cursor: "pointer",
        touchAction: "none",
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <DesktopIconSvg type={item.type} />
      <span
        className="pointer-events-none text-center text-[11.5px] leading-tight"
        style={{ color: "var(--color-desktop-label)", fontWeight: 500 }}
      >
        {item.label}
      </span>
    </div>
  );
}

// =====================================================================
// Pinned-experiment icon (drag-to-desktop targets land here).
// Uses the same pointer-event drag mechanics as DraggableIcon but
// shows the experiment's hypothesis label and exposes an unpin × on
// hover.
// =====================================================================
function PinnedIcon({
  pin,
  onOpen,
  onUnpin,
  onCommit,
}: {
  pin: PinnedExperiment;
  onOpen: () => void;
  onUnpin: () => void;
  onCommit: (x: number, y: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    pointerStartX: 0,
    pointerStartY: 0,
    baseX: 0,
    baseY: 0,
    latestX: 0,
    latestY: 0,
    dragging: false,
    moved: false,
    rafPending: false,
  });
  const [hovered, setHovered] = useState(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const s = dragState.current;
      s.pointerStartX = e.clientX;
      s.pointerStartY = e.clientY;
      s.baseX = pin.x;
      s.baseY = pin.y;
      s.latestX = pin.x;
      s.latestY = pin.y;
      s.dragging = true;
      s.moved = false;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    [pin.x, pin.y]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.pointerStartX;
    const dy = e.clientY - s.pointerStartY;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      s.moved = true;
      rootRef.current?.classList.add("dragging");
    }
    s.latestX = s.baseX + dx;
    s.latestY = s.baseY + dy;
    if (!s.rafPending) {
      s.rafPending = true;
      requestAnimationFrame(() => {
        s.rafPending = false;
        const el = rootRef.current;
        if (el) {
          el.style.transform = `translate3d(${s.latestX}px, ${s.latestY}px, 0)`;
        }
      });
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = dragState.current;
      if (!s.dragging) return;
      s.dragging = false;
      try {
        if (e.currentTarget && "releasePointerCapture" in e.currentTarget) {
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        }
      } catch {}
      rootRef.current?.classList.remove("dragging");
      if (!s.moved) {
        onOpen();
        return;
      }
      onCommit(s.latestX, s.latestY);
    },
    [onCommit, onOpen]
  );

  return (
    <div
      ref={rootRef}
      className="desktop-icon absolute z-10 flex flex-col items-center gap-1 px-2 py-2 select-none"
      style={{
        left: 0,
        top: 0,
        width: ICON_WIDTH,
        cursor: "pointer",
        touchAction: "none",
        transform: `translate3d(${pin.x}px, ${pin.y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={pin.hypothesis}
    >
      <div className="relative">
        <PinnedIconSvg />
        {hovered && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onUnpin();
            }}
            aria-label="Remove from desktop"
            className="absolute -top-1 -right-1 flex h-[18px] w-[18px] items-center justify-center"
            style={{
              background: "var(--color-error)",
              color: "white",
              border: "1.5px solid var(--color-surface-solid)",
              borderRadius: "50%",
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      <span
        className="pointer-events-none text-center text-[11.5px] leading-tight"
        style={{
          color: "var(--color-desktop-label)",
          fontWeight: 500,
          maxWidth: ICON_WIDTH - 8,
          wordBreak: "break-word",
        }}
      >
        {pinnedLabel(pin)}
      </span>
    </div>
  );
}

function PinnedIconSvg({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      {/* Document body in surface, accent stripe top */}
      <path
        d="M11 6 L 36 6 L 44 14 L 44 44 Q 44 46 42 46 L 11 46 Q 9 46 9 44 L 9 8 Q 9 6 11 6 Z"
        fill="var(--color-surface)"
        stroke="var(--color-border-strong)"
        strokeWidth="1"
      />
      <path
        d="M11 6 L 36 6 L 44 14 L 9 14 L 9 8 Q 9 6 11 6 Z"
        fill="var(--color-accent)"
        opacity="0.88"
      />
      <path d="M36 6 L 36 14 L 44 14" stroke="var(--color-border-strong)" strokeWidth="1" fill="none" />
      {/* Inner pipette mark — tiny version of app icon */}
      <rect x="23" y="20" width="6" height="9" fill="var(--color-accent)" rx="1" />
      <path d="M23 29 L 21 32 L 31 32 L 29 29 Z" fill="var(--color-accent)" />
      <path
        d="M26 33 C 23 36 23 38 26 38 C 29 38 29 36 26 33 Z"
        fill="var(--color-accent)"
      />
    </svg>
  );
}

function DesktopIconSvg({
  type,
  size = 52,
}: {
  type: "folder" | "app" | "doc";
  size?: number;
}) {
  if (type === "folder") {
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <path
          d="M6 14 L 18 14 L 21 17 L 46 17 Q 48 17 48 19 L 48 40 Q 48 42 46 42 L 6 42 Q 4 42 4 40 L 4 16 Q 4 14 6 14 Z"
          fill="var(--color-accent)"
          fillOpacity="0.85"
          stroke="var(--color-accent)"
          strokeWidth="1"
        />
        <path
          d="M6 18 L 21 18 L 24 21 L 46 21 Q 48 21 48 23 L 48 40 Q 48 42 46 42 L 6 42 Q 4 42 4 40 L 4 20 Q 4 18 6 18 Z"
          fill="var(--color-accent)"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="0.5"
        />
      </svg>
    );
  }
  if (type === "app") {
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <rect
          x="6"
          y="6"
          width="40"
          height="40"
          rx="8"
          fill="var(--color-accent)"
        />
        <path
          d="M19 14h14M22 14v10l-4 7a3 3 0 003 4h10a3 3 0 003-4l-4-7V14"
          stroke="white"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      <path
        d="M12 6 L 36 6 L 44 14 L 44 44 Q 44 46 42 46 L 12 46 Q 10 46 10 44 L 10 8 Q 10 6 12 6 Z"
        fill="var(--color-surface)"
        stroke="var(--color-border-strong)"
        strokeWidth="1"
      />
      <path d="M36 6 L 36 14 L 44 14" stroke="var(--color-border-strong)" strokeWidth="1" fill="none" />
      <line x1="16" y1="22" x2="38" y2="22" stroke="var(--color-text-muted)" strokeWidth="1" />
      <line x1="16" y1="28" x2="38" y2="28" stroke="var(--color-text-muted)" strokeWidth="1" />
      <line x1="16" y1="34" x2="32" y2="34" stroke="var(--color-text-muted)" strokeWidth="1" />
    </svg>
  );
}
