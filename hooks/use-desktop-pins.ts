"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

export interface PinnedExperiment {
  experimentId: string;
  hypothesis: string;
  domain: string | null;
  x: number;
  y: number;
}

const STORAGE_KEY = "aliquot:pinned-experiments";

// Layout constants — match DesktopIcons.tsx so pins line up with the
// static icons grid.
const ICON_HEIGHT = 88;
const COLUMN_X = 24;
const COLUMN_X_STEP = 100;
// Static desktop items (experiments folder, new experiment, guide.md)
// occupy slots y = 24, 124, 224. The first pin lands below them.
const FIRST_PIN_Y = 324;
const ROW_STEP = 100;
const BOTTOM_RESERVE = 96; // dock + a margin

/**
 * Manages the user's pinned experiments — desktop shortcuts to specific
 * past plans. The Library window's drag-to-desktop produces these;
 * DesktopIcons renders them; clicking one loads its plan into the
 * existing PlanWindow via `useExperiment().loadFromHistory()`.
 *
 * `pin()` always auto-places new pins in a sequential column layout
 * (left column first, wraps right when it runs out of vertical room).
 * The drop event's X/Y are intentionally ignored so pins always land
 * predictably regardless of where the user drops them. After landing,
 * the user can still drag-reposition freely; `move()` saves the new
 * position.
 */
export function useDesktopPins() {
  const [pinned, setPinned] = useLocalStorage<PinnedExperiment[]>(STORAGE_KEY, []);

  const pin = useCallback(
    (item: { experimentId: string; hypothesis: string; domain: string | null }) => {
      setPinned((prev) => {
        const existing = prev.find((p) => p.experimentId === item.experimentId);
        if (existing) {
          // Already on the desktop — leave its position alone, just
          // bring it forward in the array order.
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
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const maxY = Math.max(0, viewportHeight - ICON_HEIGHT - BOTTOM_RESERVE);

  // Walk columns left-to-right, top-to-bottom, looking for the first
  // unoccupied slot. The static-icon column starts at COLUMN_X with
  // its bottom at y=312 (24 + 100×3 - row spacing). Pins start at
  // FIRST_PIN_Y and step by ROW_STEP.
  for (let col = 0; col < 6; col++) {
    const x = COLUMN_X + col * COLUMN_X_STEP;
    const startY = col === 0 ? FIRST_PIN_Y : 24;
    for (let y = startY; y <= maxY; y += ROW_STEP) {
      if (!existing.some((p) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12)) {
        return { x, y };
      }
    }
  }
  // Fallback if everything's full — stack on top of the first slot.
  return { x: COLUMN_X, y: FIRST_PIN_Y };
}
