"use client";

import { useEffect } from "react";
import { ThemeContext, useThemeProvider } from "@/hooks/use-theme";
import {
  WindowManagerContext,
  useWindowManagerProvider,
} from "@/hooks/use-window-manager";
import { ExperimentContext, useExperimentProvider } from "@/hooks/use-experiment";
import { BootScreen } from "./BootScreen";
import { MenuBar } from "./MenuBar";
import { Taskbar } from "./Taskbar";
import { Wallpaper } from "./Wallpaper";
import { DesktopIcons } from "./DesktopIcons";
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

  return (
    <ThemeContext value={theme}>
      <WindowManagerContext value={windowManager}>
        <ExperimentContext value={experiment}>
        <BootScreen />
        <div className="desktop-brightness relative h-dvh w-full select-none">
          <Wallpaper />
          <MenuBar />

          <div
            id="desktop-content"
            className="absolute inset-0 bottom-0"
            style={{ top: "34px" }}
            tabIndex={-1}
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
        </div>
        </ExperimentContext>
      </WindowManagerContext>
    </ThemeContext>
  );
}
