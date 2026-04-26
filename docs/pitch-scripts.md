# Aliquot — 60-second pitch scripts

Two videos. Frontend = product walkthrough. Backend = architecture +
defensibility. Each script targets ~150 words to comfortably fit 60
seconds at a steady pace.

---

## Frontend video (60s) — "What it does"

**On-screen action: blank desktop, then live demo.**

> Aliquot is an AI Scientist with a desktop interface — every
> experiment is its own workspace, built on Next.js 16 and React 19.

**[Type into Hypothesis window: "Metformin extends yeast lifespan via AMPK"]**

> You write a hypothesis in plain English. Click Run.

**[Pipeline status streams: validator → classifier → lit QC]**

> A Haiku validator catches vague prompts and rewrites them for
> confirmation. A classifier picks the domain. The Lit QC window
> streams in real references from OpenAlex — every one a real paper.

**[Plan window populates section by section]**

> The Plan window streams in a full protocol: materials with verified
> Tavily-grounded catalog numbers, equipment, budget, timeline,
> validation, and a per-claim confidence chart.

**[Open Scientist Review, type "delete step 1"]**

> Disagree? Scientist Review applies your feedback to *this* plan in
> ten seconds via a Haiku reviser — or saves it as a domain-wide
> guideline that steers every future run.

**[Cut to desktop showing Library, Guidelines, Docs icons]**

> Past runs in the Library, rules in Guidelines, full HTTP and MCP
> docs ship with the app. Aliquot — from a sentence to a runnable
> experiment.

---

## Backend video (60s) — "How it works"

**On-screen: the simplified architecture flowchart from
`docs/architecture-simple.mmd`. Zoom into each phase as it's
mentioned. Tech labels stay visible throughout.**

> Aliquot's backend is a 7-stage pipeline split into 3 HTTP phases on
> Vercel Fluid Compute — each finishes inside the 120-second cap.

**[Highlight Validate + Classify + Lit QC]**

> Phase 1 streams Server-Sent Events. Claude Haiku 4.5 validates and
> rewrites vague hypotheses. Haiku again classifies the domain. Sonnet
> 4.6 runs literature QC against OpenAlex.

**[Highlight Generate, with arrows from Tavily and Guidelines]**

> Phase 2 is the generator. Haiku extracts reagents. Tavily searches
> fan out in parallel against vendor catalogs. Domain guidelines —
> stored as pgvector embeddings in Supabase — feed back as few-shot
> context. Haiku synthesizes the plan in a single shot, no tool loop.

**[Highlight Verify + Confidence]**

> Phase 3 hands off to Sonnet for live catalog verification, then
> Haiku scores per-claim confidence and persists the final plan.

**[Highlight feedback loop arrows]**

> Feedback is scope-aware. "This experiment only" routes through a
> Haiku reviser. "General guideline" feeds the next plan's few-shot.
> The system gets sharper with every reviewed run.

> Anthropic, Tavily, Supabase pgvector, Next.js, Vercel. Open source.
> MCP-ready.

---

## Tips for shooting

**Frontend**
- Keep the same hypothesis text used in the script ("Metformin extends
  yeast lifespan via AMPK") — short, biology, hits the Lit QC stage
  visibly with a real paper.
- Pre-clear the Library / Guidelines so the desktop looks intentional.
- Don't read the on-screen text aloud — narrate the *value*, let the UI
  speak for itself.
- If the pipeline takes >40s, cut to the finished plan. Audiences don't
  watch loaders.

**Backend**
- Open the simplified flowchart at <https://mermaid.live> with the
  contents of `docs/architecture-simple.mmd` pasted in. Export SVG at
  2x.
- Animate by zooming/panning into each phase as you mention it (any
  screen recorder + Keynote/Premiere zoom keyframes works).
- Show one quick code snippet — the Reviser system prompt or the
  Phase 2 generator signature — to ground the architecture in real
  code.
- End on the `mcp-aliquot.ts` snippet from `Docs → MCP integration` for
  the "anyone can use this" payoff.

## Word counts

- Frontend: ~170 words → ~64s at 160 wpm. Drop "built on Next.js 16
  and React 19" in the opener if tight.
- Backend: ~165 words → ~62s. Drop "stored as pgvector embeddings in
  Supabase" in Phase 2 if tight — the flowchart already shows it.
