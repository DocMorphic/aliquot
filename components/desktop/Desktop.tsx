"use client";

import { useCallback, useEffect } from "react";
import { ThemeContext, useThemeProvider } from "@/hooks/use-theme";
import {
  WindowManagerContext,
  useWindowManagerProvider,
} from "@/hooks/use-window-manager";
import { ExperimentContext, useExperimentProvider } from "@/hooks/use-experiment";
import { ModalContext, useModalProvider } from "@/hooks/use-modal";
import { useDesktopPins, type PinnedExperiment } from "@/hooks/use-desktop-pins";
import { BootScreen } from "./BootScreen";
import { MenuBar } from "./MenuBar";
import { Taskbar } from "./Taskbar";
import { Wallpaper } from "./Wallpaper";
import { DesktopIcons } from "./DesktopIcons";
import { Modal } from "@/components/ui/Modal";
import { Window } from "@/components/window/Window";
import { APP_REGISTRY } from "@/lib/constants";

import { HypothesisWindow } from "@/components/apps/HypothesisWindow";
import { LitQcWindow } from "@/components/apps/LitQcWindow";
import { PlanWindow } from "@/components/apps/PlanWindow";
import { ReviewWindow } from "@/components/apps/ReviewWindow";
import { LibraryApp } from "@/components/apps/LibraryApp";
import { HelpApp } from "@/components/apps/HelpApp";
import { SettingsApp } from "@/components/apps/SettingsApp";

const APP_COMPONENTS: Record<string, React.ComponentType> = {
  hypothesis: HypothesisWindow,
  "lit-qc": LitQcWindow,
  plan: PlanWindow,
  review: ReviewWindow,
  library: LibraryApp,
  help: HelpApp,
  settings: SettingsApp,
};

export function Desktop() {
  const theme = useThemeProvider();
  const windowManager = useWindowManagerProvider();
  const experiment = useExperimentProvider();
  const modal = useModalProvider();
  const desktopPins = useDesktopPins();

  // Auto-open the Hypothesis window so visitors immediately see the entry point.
  useEffect(() => {
    windowManager.openWindow("hypothesis");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const focused = windowManager.getFocusedAppId();
        if (focused) windowManager.closeWindow(focused);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        windowManager.openWindow("hypothesis");
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey) {
        const focused = windowManager.getFocusedAppId();
        const key = e.key.toLowerCase();
        if (key === "w" && focused) {
          e.preventDefault();
          windowManager.closeWindow(focused);
        } else if (key === "f" && focused) {
          e.preventDefault();
          windowManager.maximizeWindow(focused);
        } else if (key === "m" && focused) {
          e.preventDefault();
          windowManager.minimizeWindow(focused);
        } else if (key === "c" && focused) {
          e.preventDefault();
          windowManager.centerWindow(focused);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [windowManager]);

  // Drag-and-drop: Library cards drop here to become desktop pins.
  // The card's onDragStart sets a JSON payload on dataTransfer; we read
  // it on drop and compute coordinates relative to the desktop content
  // area so the icon lands where the cursor was.
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("application/x-aliquot-experiment")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const raw = e.dataTransfer.getData("application/x-aliquot-experiment");
      if (!raw) return;
      let payload: { experimentId: string; hypothesis: string; domain?: string | null };
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      e.preventDefault();
      // Drop coordinates intentionally ignored — pins auto-place in
      // a sequential column layout (predictable + matches the user's
      // mental model of icons appearing "below the existing ones").
      // The user can drag-reposition after the pin lands.
      desktopPins.pin({
        experimentId: payload.experimentId,
        hypothesis: payload.hypothesis,
        domain: payload.domain ?? null,
      });
    },
    [desktopPins]
  );

  return (
    <ThemeContext value={theme}>
      <WindowManagerContext value={windowManager}>
        <ExperimentContext value={experiment}>
          <ModalContext value={modal}>
            <BootScreen />
            <div className="desktop-brightness relative h-dvh w-full select-none">
              <Wallpaper />
              <MenuBar />

              <div
                id="desktop-content"
                className="absolute inset-0 bottom-0"
                style={{ top: "34px" }}
                tabIndex={-1}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <DesktopIcons />

                <div className="absolute inset-0 overflow-hidden">
                  {windowManager.windows
                    .filter((w) => w.isOpen && !w.isMinimized)
                    .map((w) => {
                      const AppComponent = APP_COMPONENTS[w.appId];
                      const appDef = APP_REGISTRY[w.appId];
                      if (!AppComponent || !appDef) return null;
                      return (
                        <Window key={w.appId} appId={w.appId}>
                          <AppComponent />
                        </Window>
                      );
                    })}
                </div>
              </div>

              <Taskbar />

              {/* Themed modal — controlled by the modal context. */}
              {modal._active && (
                <Modal
                  open={true}
                  title={modal._active.title}
                  message={modal._active.message}
                  variant={modal._active.danger ? "danger" : "neutral"}
                  onDismiss={() => modal._dismiss(false)}
                  actions={
                    modal._active.isConfirm
                      ? [
                          {
                            label: modal._active.cancelLabel ?? "Cancel",
                            onClick: () => modal._dismiss(false),
                            variant: "secondary",
                          },
                          {
                            label: modal._active.confirmLabel ?? "Confirm",
                            onClick: () => modal._dismiss(true),
                            variant: modal._active.danger ? "danger" : "primary",
                          },
                        ]
                      : [
                          {
                            label: modal._active.confirmLabel ?? "OK",
                            onClick: () => modal._dismiss(true),
                            variant: "primary",
                          },
                        ]
                  }
                />
              )}
            </div>
          </ModalContext>
        </ExperimentContext>
      </WindowManagerContext>
    </ThemeContext>
  );
}
