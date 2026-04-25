"use client";

import { useTheme, type AccentColor, type Currency } from "@/hooks/use-theme";
import { useModal } from "@/hooks/use-modal";
import { MODELS } from "@/lib/constants";

const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: "USD", label: "US Dollar", symbol: "$" },
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "GBP", label: "British Pound", symbol: "£" },
];

const ACCENTS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: "blue", label: "Lab blue", swatch: "#1E40AF" },
  { value: "teal", label: "Teal", swatch: "#0F766E" },
  { value: "purple", label: "Purple", swatch: "#6D28D9" },
];

export function SettingsApp() {
  const {
    mode,
    setMode,
    brightness,
    setBrightness,
    accent,
    setAccent,
    currency,
    setCurrency,
  } = useTheme();
  const { confirm } = useModal();

  const supabaseHost =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, "") ?? "(not configured)";

  const handleReset = async () => {
    const ok = await confirm({
      title: "Reset preferences?",
      message:
        "Clears your theme, accent, currency, and pinned experiments. Server-side data in Supabase is untouched.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (!ok) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("aliquot:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-5 text-[13px]">
      <div>
        <h2 className="text-[16px]" style={{ fontWeight: 600 }}>
          Settings
        </h2>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
          Local preferences. Persisted in localStorage.
        </p>
      </div>

      <Section label="APPEARANCE">
        <Row label="Theme">
          <div
            className="flex overflow-hidden border"
            style={{
              borderColor: "var(--color-border)",
              borderRadius: 6,
              minWidth: 140,
            }}
          >
            {(["light", "dark"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 px-3 py-1 text-[12px] transition-colors"
                style={{
                  background: mode === m ? "var(--color-accent)" : "transparent",
                  color: mode === m ? "white" : "var(--color-text)",
                  fontWeight: mode === m ? 500 : 400,
                }}
              >
                {m === "light" ? "☀ Light" : "☾ Dark"}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Accent">
          <div className="flex gap-1.5">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                onClick={() => setAccent(a.value)}
                title={a.label}
                aria-label={a.label}
                className="h-6 w-6 transition-transform"
                style={{
                  background: a.swatch,
                  borderRadius: "50%",
                  border:
                    accent === a.value
                      ? "2px solid var(--color-text)"
                      : "1px solid var(--color-border)",
                  transform: accent === a.value ? "scale(1.05)" : "scale(1)",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </Row>

        <Row label={`Brightness (${brightness}%)`} stack>
          <input
            type="range"
            min={70}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--color-accent)" }}
          />
        </Row>
      </Section>

      <Section label="EXPERIMENT DEFAULTS">
        <Row label="Currency">
          <div className="flex gap-1">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCurrency(c.value)}
                className="border px-2.5 py-1 text-[11.5px] transition-colors"
                style={{
                  background:
                    currency === c.value ? "var(--color-accent)" : "var(--color-surface-alt)",
                  color: currency === c.value ? "white" : "var(--color-text)",
                  borderColor:
                    currency === c.value ? "var(--color-accent)" : "var(--color-border)",
                  borderRadius: 4,
                  fontWeight: 500,
                }}
              >
                {c.symbol} {c.value}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section label="ABOUT">
        <Row label="Version">
          <span className="font-mono text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
            0.1.0
          </span>
        </Row>
        <Row label="Reasoning model">
          <span className="font-mono text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
            {MODELS.reason}
          </span>
        </Row>
        <Row label="Fast model">
          <span className="font-mono text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
            {MODELS.fast}
          </span>
        </Row>
        <Row label="Database host">
          <span
            className="truncate font-mono text-[11px]"
            style={{ color: "var(--color-text-muted)", maxWidth: 200 }}
            title={supabaseHost}
          >
            {supabaseHost}
          </span>
        </Row>
      </Section>

      <button
        onClick={handleReset}
        className="border px-3 py-1.5 text-[11.5px] transition-colors"
        style={{
          background: "var(--color-surface-alt)",
          borderColor: "var(--color-border)",
          color: "var(--color-error)",
          borderRadius: 4,
          alignSelf: "flex-start",
        }}
      >
        Reset preferences
      </button>

      <div
        className="mt-auto border-t pt-3 text-[11px]"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
      >
        Aliquot · Hack-Nation × Fulcrum Science
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div
        className="text-[10.5px] font-semibold tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
  stack,
}: {
  label: string;
  children: React.ReactNode;
  stack?: boolean;
}) {
  return (
    <div className={stack ? "flex flex-col gap-1.5" : "flex items-center justify-between"}>
      <span style={{ color: "var(--color-text)" }}>{label}</span>
      {children}
    </div>
  );
}
