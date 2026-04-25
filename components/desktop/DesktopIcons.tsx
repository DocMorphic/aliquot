"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowManager } from "@/hooks/use-window-manager";

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
  const { openWindow } = useWindowManager();
  const isMobile = useIsMobile();
  const [positions, setPositions] = useState<Record<string, IconPos>>(DEFAULT_POSITIONS);

  const handleActivate = useCallback(
    (item: DesktopItem) => {
      if (item.appId) openWindow(item.appId);
    },
    [openWindow]
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
    </>
  );
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
