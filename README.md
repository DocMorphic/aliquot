# Aliquot — The AI Scientist

Aliquot turns a plain-language scientific hypothesis into an
operationally realistic experiment plan: protocol with citations,
materials with verified catalog numbers, equipment, budget, timeline,
validation, and per-claim confidence scores. Delivered through a
desktop-OS interface where each experiment is its own workspace.

- **Live demo:** <https://aliquot-pi.vercel.app>
- **Repo:** <https://github.com/DocMorphic/aliquot>

## Run locally

```bash
git clone https://github.com/DocMorphic/aliquot
cd aliquot
cp .env.local.example .env.local
# fill in the four keys (see "Environment" below)
npm install
npm run dev
# open http://localhost:3000
```

Then run `supabase/schema.sql` in your Supabase project's SQL editor
once. It uses `add column if not exists` everywhere, so it's safe to
re-run after pulls.

## Environment

`.env.local` needs:

```
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

## Architecture

A 7-stage pipeline split into 3 streamed HTTP phases:

1. **Phase 1 (SSE):** Validator → Classifier → Lit QC → emits an
   `experiment_started` event with the persisted experiment id.
2. **Phase 2 (POST `/generate`):** Reagent extraction → parallel
   Tavily catalog search → Haiku synthesis (no tool loop) → draft
   plan saved.
3. **Phase 3 (POST `/verify`):** Live re-verification of every
   catalog number → Haiku confidence annotation → final plan.

Diagrams + voiceover scripts:

- `docs/architecture-simple.mmd` — left-to-right, 14 nodes (use this
  for the demo video — paste into <https://mermaid.live>)
- `docs/architecture.md` — full architecture reference
- `docs/pitch-scripts.md` — 60s frontend + 60s backend scripts
- `docs/pitch-flowchart-script.md` — 30s flowchart voiceover

## Stack

- **Frontend:** Next.js 16 App Router, React 19, Tailwind 4
- **AI:** Anthropic Claude (Haiku 4.5 + Sonnet 4.6)
- **Search:** Tavily (vendor catalogs), OpenAlex (literature)
- **Data:** Supabase Postgres + Storage + pgvector
- **Hosting:** Vercel Fluid Compute

## HTTP API + MCP

The same endpoints power the UI, the MCP server, and any direct
script use. Full reference inside the app — open the **Docs** icon
on the desktop, or read `components/apps/DocsApp.tsx`. Includes a
copy-paste MCP server stub for Claude Desktop / Cursor.

## License

Open source. No warranty — review every plan before you actually
order materials.
