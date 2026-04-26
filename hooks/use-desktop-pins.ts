"use client";

import { createContext, useCallback, useContext } from "react";
import { useLocalStorage } from "./use-local-storage";

export interface PinnedExperiment {
  experimentId: string;
  hypothesis: string;
  domain: string | null;
  x: number;
  y: number;
}

const STORAGE_KEY = "aliquot:pinned-experiments";

const ICON_HEIGHT = 88;
const COLUMN_X = 24;
const COLUMN_X_STEP = 100;
const FIRST_PIN_Y = 324;
const ROW_STEP = 100;
const BOTTOM_RESERVE = 96;

interface DesktopPinsValue {
  pinned: PinnedExperiment[];
  pin: (item: { experimentId: string; hypothesis: string; domain: string | null }) => void;
  unpin: (experimentId: string) => void;
  move: (experimentId: string, x: number, y: number) => void;
}

export const DesktopPinsContext = createContext<DesktopPinsValue | null>(null);

/**
 * Read the desktop pins from a single shared source. Both Desktop's
 * drop handler and DesktopIcons' renderer call this — they share state
 * via the provider so newly pinned experiments appear instantly without
 * a page reload (previous bug: each useState/useLocalStorage instance
 * was independent, so writes from one didn't show in the other).
 */
export function useDesktopPins(): DesktopPinsValue {
  const ctx = useContext(DesktopPinsContext);
  if (!ctx) throw new Error("useDesktopPins must be used inside DesktopPinsProvider");
  return ctx;
}

export function useDesktopPinsProvider(): DesktopPinsValue {
  const [pinned, setPinned] = useLocalStorage<PinnedExperiment[]>(STORAGE_KEY, []);

  const pin = useCallback(
    (item: { experimentId: string; hypothesis: string; domain: string | null }) => {
      setPinned((prev) => {
        const existing = prev.find((p) => p.experimentId === item.experimentId);
        if (existing) {
          return [...prev.filter((p) => p.experimentId !== item.experimentId), existing];
        }
        const { x, y } = nextSlot(prev);
        return [
          ...prev,
          {
            experimentId: item.experimentId,
            hypothesis: item.hypothesis,
            domain: item.domain,
            x,
            y,
          },
        ];
      });
    },
    [setPinned]
  );

  const unpin = useCallback(
    (experimentId: string) => {
      setPinned((prev) => prev.filter((p) => p.experimentId !== experimentId));
    },
    [setPinned]
  );

  const move = useCallback(
    (experimentId: string, x: number, y: number) => {
      setPinned((prev) =>
        prev.map((p) => (p.experimentId === experimentId ? { ...p, x, y } : p))
      );
    },
    [setPinned]
  );

  return { pinned, pin, unpin, move };
}

function nextSlot(existing: PinnedExperiment[]): { x: number; y: number } {
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxY = Math.max(0, viewportHeight - ICON_HEIGHT - BOTTOM_RESERVE);
  for (let col = 0; col < 6; col++) {
    const x = COLUMN_X + col * COLUMN_X_STEP;
    const startY = col === 0 ? FIRST_PIN_Y : 24;
    for (let y = startY; y <= maxY; y += ROW_STEP) {
      if (!existing.some((p) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12)) {
        return { x, y };
      }
    }
  }
  return { x: COLUMN_X, y: FIRST_PIN_Y };
}
