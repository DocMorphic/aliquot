# Aliquot — Hackathon submission answers

Ready-to-paste answers for the structured submission form, plus the
dataset note and zipping instructions.

## Short Description

Aliquot is an AI Scientist that turns plain-language hypotheses into
operationally realistic experiment plans — protocol, real catalog
numbers, budget, timeline, and per-claim confidence — in under a
minute, delivered through a desktop-OS interface.

## 1. Problem & Challenge

Existing "AI Scientist" demos produce plausible-looking experiment
plans that hallucinate catalog numbers, citations, and protocols —
useless to a working researcher. Scientists either reject the output
entirely or spend hours hand-verifying every claim before they can
order materials. There's no AI tool a real PI would trust to draft
an experiment they're about to run.

## 2. Target Audience

Working scientists and graduate students in biology, chemistry,
physics, and climate research who need to scope new experiments
quickly. PIs evaluating new research directions. Industry R&D teams
running rapid hypothesis triage. Reviewers benefit from the live
verifier surfacing exactly where the model's confidence is weakest.

## 3. Solution & Core Features

A 7-stage AI pipeline split into 3 streamed HTTP phases: validator
(rewrites vague prompts into a paragraph the user confirms or edits),
domain classifier, literature QC against OpenAlex, grounded generator
with parallel Tavily catalog searches, adversarial skeptic, live
catalog re-verifier, and per-claim confidence annotator. Plans
include protocol steps with citations, materials with verified
catalog numbers + product URLs, equipment, budget, timeline,
validation criteria, and caveats. Scientist Review applies feedback
in two scopes — per-experiment edits revise this plan in 10 seconds,
general guidelines steer every future plan in the domain. Desktop-OS
interface with Library (rename + drag-to-desktop pin), Guidelines
pruning, file attachments (PDF/image/text) sent to Claude as native
content blocks, and an MCP server stub for Claude Desktop / Cursor.

## 4. Unique Selling Proposition (USP)

Every catalog number is grounded in a live vendor product page.
Every citation is a real paper. Every claim has a 0–100% confidence
score. The 3-phase architecture and "no-tool-loop" generator
guarantee plans complete inside Vercel's 60-second function cap, so
it actually ships on the free tier. Feedback is scope-aware —
per-experiment edits don't pollute domain knowledge; only explicit
guidelines do, and they're reviewable + deletable. MCP-ready out of
the box, so Claude Desktop and Cursor can run grounded experiments
through it.

## 5. Implementation & Technology

**Frontend:** Next.js 16 App Router, React 19, Tailwind 4, custom
desktop-OS window manager (drag, resize, focus stack, dock).

**AI:** Anthropic Claude — Haiku 4.5 for fast passes (validator,
classifier, generator synthesis, confidence, reviser); Sonnet 4.6
for reasoning passes (literature QC, catalog verification).

**Pipeline:** Phase 1 streams over Server-Sent Events; Phases 2 and
3 are JSON POSTs. The generator pre-computes Tavily searches in
parallel, then Haiku synthesizes the entire plan in a single shot —
no tool-use loop, so it always finishes inside the function timeout.

**External APIs:** Tavily Search (vendor catalogs), OpenAlex (free
open-access literature index).

**Data:** Supabase Postgres for plans, experiments, references, and
corrections; Supabase Storage for user-uploaded file attachments;
pgvector for correction embeddings.

**Hosting:** Vercel Fluid Compute (Node 24, `maxDuration: 120s` on
generator and verifier).

**MCP:** A documented stdio server stub wraps the HTTP API as a
`run_aliquot_experiment` tool.

## 6. Results & Impact

Working end-to-end deployment at <https://aliquot-pi.vercel.app>.
Generates a fully grounded biology experiment plan in ~35–45 seconds
with verified catalog numbers, real OpenAlex citations, and
confidence-scored claims. Per-experiment feedback applies in ~10
seconds. Open source at <https://github.com/DocMorphic/aliquot> —
anyone can clone, run locally with their own keys, or wire it into
Claude Desktop via the MCP integration. Demonstrates that a 3-phase
split plus "no-tool-loop" Haiku synthesis can deliver real grounded
scientific plans inside hobby-tier serverless constraints — no Pro
plan, no special infrastructure.

## Additional Information (optional)

Stretch goal achieved: corrections feed back into future plans as
few-shot context, with scope-aware design that prevents pollution of
domain knowledge. The Guidelines window lets users review and prune
outdated rules. The Reviser agent applies per-experiment feedback in
place. Architecture flowchart in `docs/architecture-simple.mmd`,
pitch scripts in `docs/pitch-scripts.md`, full HTTP + MCP
documentation accessible inside the app via the Docs window.

## Dataset

No static training or fine-tuning dataset. Aliquot grounds in
real-time public data sources:

- **OpenAlex** — <https://openalex.org> (open scholarly index, no key)
- **Tavily Search** — <https://tavily.com> (vendor catalogs + web)
- **Anthropic Claude** — <https://anthropic.com> (LLM)
- **Supabase** — <https://supabase.com> (plan + correction storage)

If the form requires a single dataset link, use
<https://openalex.org> (the primary literature source).

## Zipping the source for submission

From the repo root, run:

```bash
zip -r aliquot-submission.zip . \
  -x 'node_modules/*' \
  -x '.next/*' \
  -x '.git/*' \
  -x '.env' \
  -x '.env.local' \
  -x '.vercel/*' \
  -x '.DS_Store'
```

This excludes the heavy/private things and keeps source, schema,
docs, package.json, and `.env.example`. Final size should be a few
MB — easily under any submission cap.
