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

/**
 * Manages the user's pinned experiments — desktop shortcuts to specific
 * past plans. The Library window's drag-to-desktop produces these;
 * DesktopIcons renders them; clicking one loads its plan into the
 * existing PlanWindow via `useExperiment().loadFromHistory()`.
 *
 * Persisted in localStorage so pins survive reloads.
 */
export function useDesktopPins() {
  const [pinned, setPinned] = useLocalStorage<PinnedExperiment[]>(STORAGE_KEY, []);

  const pin = useCallback(
    (item: PinnedExperiment) => {
      setPinned((prev) => {
        const existing = prev.find((p) => p.experimentId === item.experimentId);
        if (existing) {
          // Already pinned — just move to the new drop coordinates.
          return prev.map((p) =>
            p.experimentId === item.experimentId ? { ...p, x: item.x, y: item.y } : p
          );
        }
        return [...prev, item];
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
