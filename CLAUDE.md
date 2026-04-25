# Bench OS

The AI Scientist — Hack-Nation × Fulcrum Science hackathon entry. Takes a plain-language scientific hypothesis and generates an operationally realistic experiment plan a real PI would trust enough to order materials and run.

## What it is

A desktop-OS-styled web app (forked from `~/mein/os-folio`) where each scientific question opens an "experiment" workspace of draggable windows. Users see a literature-novelty check, then a fully grounded plan: protocol with citations, materials with real catalog numbers, budget, timeline, validation approach, and confidence scores.

The differentiator vs. typical AI Scientist submissions is the **7-stage agent pipeline** (classifier → lit QC → generator → adversarial skeptic → revise → verifier → confidence annotator). Every claim grounded in a real source. Streaming status updates make the rigor visible during demo.

Stretch goal: corrections from scientist reviews flow back into Supabase and inject as few-shot examples for the next plan in the same domain — the "system that learns" demo.

## Stack

- **Frontend:** Next.js 16 + React 19 + Tailwind 4 (forked from os-folio)
- **Backend:** Next.js API routes with Server-Sent Events for pipeline streaming
- **AI:** Anthropic SDK — Sonnet 4.6 for orchestration, Haiku 4.5 for classifier + confidence
- **Search:** Semantic Scholar + arXiv (literature, keyless), Tavily (catalog #s), protocols.io (protocols)
- **DB:** Supabase (Postgres + pgvector) — plans, references, corrections
- **Hosting:** Vercel

## Important: Next.js 16

This is a recent Next.js version with breaking changes from older training data. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next-specific code.** Heed deprecation notices.

## Repo layout

- `app/` — pages + API routes (`api/experiment/run` is the SSE pipeline orchestrator)
- `components/desktop/` — OS chrome (boot screen, menu bar, dock, wallpaper, desktop icons)
- `components/window/` — window manager UI (drag, resize, focus stack)
- `components/apps/` — Bench OS app windows (HypothesisWindow, LitQcWindow, PlanWindow, ReviewWindow, HelpApp)
- `hooks/use-window-manager.ts` — full window manager state, kept from os-folio
- `lib/ai/` — Anthropic SDK wrapper, agent definitions, tool definitions, pipeline orchestrator
- `lib/search/` — Semantic Scholar, arXiv, Tavily clients
- `lib/supabase/` — Supabase client + seed corrections
- `lib/types.ts` — plan/correction/experiment domain types
- `content/sample-hypotheses.ts` — the 4 brief examples wired as quick-start chips

## Commit style

Short, present-tense. No co-authored-by tags unless asked. Don't commit when not asked.

## What's been intentionally cut for 24h scope

- Mobile responsiveness (desktop-only demo is acceptable)
- TDD (too slow for hackathon)
- Authentication (Supabase RLS open for hackathon)
- Multiple users / sessions (single-user demo flow)
