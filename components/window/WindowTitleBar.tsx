"use client";

interface WindowTitleBarProps {
  title: string;
  isFocused: boolean;
  isMaximized?: boolean;
  draggable?: boolean;
  itemCount?: number;
  statusText?: string;
  showMinimize?: boolean;
  showMaximize?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

export function WindowTitleBar({
  title,
  isFocused,
  isMaximized = false,
  draggable = true,
  itemCount,
  statusText,
  showMinimize = true,
  showMaximize = true,
  onClose,
  onMinimize,
  onMaximize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: WindowTitleBarProps) {
  return (
    <div
      className={`relative flex h-9 shrink-0 items-center justify-between border-b pl-3 pr-2 ${
        draggable ? "cursor-move" : "cursor-default"
      }`}
      style={{
        background: "var(--color-titlebar)",
        borderColor: "var(--color-titlebar-border)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Controls — LEFT (macOS-style traffic lights) */}
      <div
        className="flex h-full items-center gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="window-control-btn close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="6" height="6" viewBox="0 0 6 6">
            <line x1="1" y1="1" x2="5" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <line x1="5" y1="1" x2="1" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </button>

        {showMinimize && (
          <button
            className="window-control-btn minimize"
            onClick={onMinimize}
            aria-label="Minimize"
          >
            <svg width="6" height="6" viewBox="0 0 6 6">
              <line x1="1" y1="3" x2="5" y2="3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {showMaximize && (
          <button
            className="window-control-btn maximize"
            onClick={onMaximize}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            <svg width="6" height="6" viewBox="0 0 6 6">
              <polygon points="0,5 5,5 5,0" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>

      {/* Title — CENTER */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 truncate text-[12.5px]"
        style={{
          color: isFocused ? "var(--color-text-secondary)" : "var(--color-text-muted)",
          fontWeight: 500,
          maxWidth: "60%",
        }}
      >
        {title}
      </span>

      {/* Status / count — RIGHT */}
      <div className="flex h-full items-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        {statusText ? (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
            {statusText}
          </span>
        ) : typeof itemCount === "number" ? (
          <span>{itemCount} items</span>
        ) : null}
      </div>
    </div>
  );
}
