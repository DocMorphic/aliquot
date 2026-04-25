interface WindowContentProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function WindowContent({ children, noPadding }: WindowContentProps) {
  return (
    <div
      className={`custom-scrollbar flex-1 overflow-y-auto ${
        noPadding ? "" : "px-6 py-5"
      }`}
      style={{ color: "var(--color-text)", background: "var(--color-surface-solid)" }}
    >
      {children}
    </div>
  );
}
