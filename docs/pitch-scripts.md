# Aliquot — 60-second pitch scripts

Two videos. Frontend = product walkthrough. Backend = architecture +
defensibility. Each script targets ~150 words to comfortably fit 60
seconds at a steady pace.

---

## Frontend video (60s) — "What it does"

**On-screen action: blank desktop, then live demo.**

> Aliquot is an AI Scientist with a desktop interface — every
> experiment is its own workspace.

**[Type into Hypothesis window: "Metformin extends yeast lifespan via AMPK"]**

> You write a hypothesis in plain English. Click Run.

**[Pipeline status streams: validator → classifier → lit QC]**

> A validator gates vague prompts. A classifier picks the domain. The
> Lit QC window streams in real references — every one a real paper.

**[Plan window populates section by section]**

> The Plan window streams a full protocol: materials with verified
> catalog numbers, equipment, budget, timeline, validation, and a
> per-claim confidence chart. Every catalog number links to a real
> product page.

**[Open Scientist Review, type "delete step 1"]**

> Disagree with something? Scientist Review applies your feedback to
> *this* plan in ten seconds — or saves it as a domain-wide guideline
> for every future run.

**[Cut to desktop showing Library, Guidelines, Docs icons]**

> Past runs in the Library, rules in Guidelines, full HTTP and MCP
> docs ship with the app. Aliquot — from a sentence to a runnable
> experiment.

---

## Backend video (60s) — "How it works"

**On-screen: the architecture flowchart from `docs/architecture.md`,
zoomed and animated as each phase is mentioned.**

> Aliquot's backend is a 7-stage pipeline split into 3 HTTP phases —
> each finishes inside Vercel's 60-second cap.

**[Highlight Phase 1 box]**

> Phase 1 streams over Server-Sent Events. A Haiku validator catches
> vague prompts. A classifier picks biology, chemistry, physics, or
> climate. OpenAlex returns grounded references, persisted to
> Supabase.

**[Highlight Phase 2 box]**

> Phase 2 is the generator. Haiku extracts reagents. Tavily searches
> fan out in parallel against vendor catalogs. Then Haiku synthesizes
> the entire plan in a single shot — no tool-use loop, so it always
> finishes fast.

**[Highlight Phase 3 box]**

> Phase 3 verifies every catalog number with a fresh Tavily check, runs
> a confidence pass, and writes the final plan.

**[Highlight feedback loop arrows]**

> Scientist feedback is scoped. "This experiment only" routes to a
> reviser that edits the plan in place. "General guideline" feeds the
> next plan's few-shot context. The system gets smarter as it
> accumulates trusted knowledge.

> Anthropic, Tavily, Supabase, Next.js. Open source. MCP-ready.

---

## Tips for shooting

**Frontend**
- Keep the same hypothesis text used in the script ("Metformin extends
  yeast lifespan via AMPK") — short, biology, hits the lit QC stage
  visibly.
- Pre-clear the Library / Guidelines so the desktop looks intentional.
- Don't read the on-screen text aloud — narrate the *value*, let the UI
  speak for itself.
- If the pipeline takes >40s, cut to the finished plan. Audiences don't
  watch loaders.

**Backend**
- Open the flowchart at <https://mermaid.live> with the contents of
  `docs/architecture.md` pasted in. Export at 2x resolution.
- Animate by zooming/panning into each phase as you mention it (any
  screen recorder + Keynote/Premiere zoom keyframes works fine).
- Show one quick code snippet — the Reviser system prompt or the Phase
  2 generator function signature — to ground the architecture in real
  code.
- End on the `mcp-aliquot.ts` snippet from `Docs → MCP integration` for
  the "anyone can use this" payoff.

## Word counts

- Frontend: ~165 words → ~62s at 160 wpm. Trim "Disagree with
  something?" to "Disagree?" if tight.
- Backend: ~155 words → ~58s. Drop "of the entire plan in a single
  shot" → "the plan in one shot" if tight.
