"use client";

export function HelpApp() {
  return (
    <div className="flex flex-col gap-4 text-[13px]" style={{ lineHeight: 1.6 }}>
      <div>
        <h2
          className="font-display text-[26px]"
          style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Aliquot
        </h2>
        <p className="mt-1" style={{ color: "var(--color-text-muted)" }}>
          The AI Scientist · From hypothesis to runnable experiment plan.
        </p>
      </div>

      <Section title="What this does">
        Take a plain-language scientific hypothesis and produce an operationally realistic
        experiment plan a real PI would trust enough to order materials and run.
        Every catalog number is grounded in a real product page. Every protocol step
        cites a real published source. Every claim has a confidence score.
      </Section>

      <Section title="How to demo">
        <ol className="ml-4 list-decimal space-y-1.5">
          <li>Open the Hypothesis window. Click a sample chip or type your own.</li>
          <li>Click <kbd>Run</kbd> (or press <kbd>⌘+Enter</kbd>).</li>
          <li>Lit QC populates first — novelty signal + 1–3 references.</li>
          <li>The Plan window streams in section by section: protocol, materials, budget, timeline, validation.</li>
          <li>Click <kbd>Review &amp; Correct</kbd> to leave structured feedback. Future plans in the same domain will reflect it.</li>
        </ol>
      </Section>

      <Section title="The 7-stage pipeline">
        <ol className="ml-4 list-decimal space-y-1">
          <li>Domain classifier — biology / chemistry / physics / climate</li>
          <li>Lit QC — Semantic Scholar + arXiv similarity search</li>
          <li>Generator — Sonnet 4.6 with tool use against protocols.io and Tavily</li>
          <li>Skeptic — adversarial review for unrealistic concentrations, missing controls</li>
          <li>Revise — incorporates the critique</li>
          <li>Verifier — live re-checks every catalog number</li>
          <li>Confidence annotator — 0–100% per claim based on source agreement</li>
        </ol>
      </Section>

      <Section title="Keyboard shortcuts">
        <ul className="ml-4 list-disc space-y-1 font-mono text-[11.5px]">
          <li>⌘+N — New experiment</li>
          <li>⌘+Enter (in Hypothesis box) — Run</li>
          <li>⌘+⌥+W — Close focused window</li>
          <li>⌘+⌥+F — Maximize</li>
          <li>⌘+⌥+M — Minimize</li>
          <li>⌘+⌥+C — Center</li>
          <li>Esc — Close focused window</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="mb-1.5 text-[10.5px] font-semibold tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {title.toUpperCase()}
      </h3>
      <div style={{ color: "var(--color-text-secondary)" }}>{children}</div>
    </div>
  );
}
