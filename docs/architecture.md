# Aliquot — Architecture

End-to-end flow of a single experiment, from a hypothesis the user types
in the browser to a verified plan persisted in Supabase.

## How to render this diagram

The diagram below is in [Mermaid](https://mermaid.live) syntax:

- **GitHub**: renders inline on this page automatically.
- **Live editor**: copy the block into <https://mermaid.live> for a
  high-res SVG/PNG export — useful for slides + video.
- **CLI / CI**: `npx -y @mermaid-js/mermaid-cli -i docs/architecture.md
  -o docs/architecture.png -b transparent -t dark` to render a PNG.

## Pipeline

```mermaid
flowchart TD
    %% ============================================================
    %% Aliquot — full request flow
    %% ============================================================

    classDef ui fill:#1e3a8a,stroke:#1e40af,color:#fff;
    classDef api fill:#0f766e,stroke:#115e59,color:#fff;
    classDef ai fill:#7c2d12,stroke:#9a3412,color:#fff;
    classDef ext fill:#4b5563,stroke:#6b7280,color:#fff;
    classDef db fill:#312e81,stroke:#3730a3,color:#fff;

    %% ----- Client -----
    User([Scientist])
    HW[HypothesisWindow]:::ui
    PW[PlanWindow]:::ui
    RW[ReviewWindow]:::ui
    LW[Library / Guidelines / Docs]:::ui

    User -->|types hypothesis<br/>+ optional files| HW
    HW -->|POST /api/uploads/file<br/>multipart| Upload[/POST uploads.file/]:::api
    Upload --> Storage[(Supabase Storage)]:::db

    %% ----- PHASE 1 — SSE -----
    HW -->|POST /api/experiment/run<br/>SSE| Phase1{{Phase 1 — SSE}}:::api

    Phase1 --> Validator[Validator<br/>Haiku 4.5]:::ai
    Validator -- specific --> Classifier
    Validator -- vague --> NeedsRefine[/needs_refinement<br/>or needs_confirmation/]:::api
    NeedsRefine --> HW

    Classifier[Classifier<br/>Haiku 4.5]:::ai --> LitQC
    LitQC[Lit QC<br/>Sonnet 4.6]:::ai --> OpenAlex[(OpenAlex<br/>API)]:::ext
    OpenAlex --> LitQC

    LitQC --> ExpRow[(experiments<br/>references_found)]:::db
    LitQC -->|experiment_started<br/>+ lit_qc events| HW
    HW -->|store experimentId| Phase2

    %% ----- PHASE 2 — generate -----
    Phase2{{Phase 2<br/>POST /api/experiment/:id/generate}}:::api
    Phase2 --> LoadAttachments[loadAttachmentsForModel<br/>PDF / image / text → content blocks]:::api
    LoadAttachments --> Storage

    Phase2 --> Reagent[Reagent extractor<br/>Haiku 4.5]:::ai
    Reagent --> TavilyBatch[Tavily catalog batch<br/>parallel fan-out]:::ext
    TavilyBatch --> Generator
    Phase2 --> CorrFetch[getRecentCorrections<br/>scope = general]:::api
    CorrFetch --> Corrections[(corrections)]:::db
    CorrFetch --> Generator

    Generator[Generator<br/>Haiku synthesis<br/>no tool loop]:::ai --> Skeptic
    Skeptic[Skeptic / Revise<br/>Sonnet 4.6]:::ai --> Generator
    Generator --> DraftPlan[(plans v1)]:::db
    Generator -->|plan JSON<br/>verificationPending: true| PW

    %% ----- PHASE 3 — verify -----
    PW -->|POST /api/experiment/:id/verify| Phase3{{Phase 3<br/>POST verify}}:::api
    Phase3 --> Verifier[Catalog # verifier<br/>Sonnet 4.6]:::ai
    Verifier --> TavilyVerify[(Tavily<br/>recheck)]:::ext
    TavilyVerify --> Verifier
    Verifier --> Confidence[Confidence annotator<br/>Haiku 4.5]:::ai
    Confidence --> FinalPlan[(plans updated<br/>experiments.status = done)]:::db
    Confidence --> PW

    %% ----- Feedback loop -----
    PW --> RW
    RW -->|POST /api/corrections<br/>scope = experiment| ApplyBranch{scope?}:::api
    ApplyBranch -- experiment --> Reviser[Reviser<br/>Haiku 4.5<br/>edit this plan]:::ai
    Reviser --> FinalPlan
    Reviser -->|revised plan| PW
    ApplyBranch -- general --> Corrections

    %% ----- Library / Guidelines / Docs -----
    LW -->|GET /api/experiments<br/>PATCH title<br/>DELETE| ExpRow
    LW -->|GET /api/guidelines<br/>DELETE| Corrections
```

## Three-phase split — why

Vercel Hobby caps function execution at 60s. The full 7-stage pipeline
takes 60-90s end-to-end on biology hypotheses, so a single endpoint
would time out mid-generation. Phase 1 + Phase 2 + Phase 3 each finish
inside the cap; the client orchestrates the chain. This also means the
user sees streaming literature results in <5s, then a fully grounded
plan in <40s.

## Stack at a glance

| Layer        | Tech                                                         |
|--------------|--------------------------------------------------------------|
| UI           | Next.js 16 · React 19 · Tailwind 4 · desktop-OS shell        |
| API          | Next.js App Router (Node runtime, Fluid Compute)             |
| Reasoning    | Anthropic Sonnet 4.6 (verifier, lit QC)                      |
| Fast passes  | Anthropic Haiku 4.5 (validator, classifier, generator, confidence, reviser) |
| Search       | Tavily (vendor catalogs) · OpenAlex (literature)             |
| Storage      | Supabase Postgres + Storage + pgvector (corrections embeddings) |
| Hosting      | Vercel                                                       |

## Feedback model

Every correction the user submits in Scientist Review carries a
`scope`:

- `scope = 'experiment'` — applied immediately to *this* plan via the
  reviser. Stored as audit trail. **Never** injected into future
  plans in the domain.
- `scope = 'general'` — added to the domain's guideline pool. Future
  generator runs in the same domain pull recent guidelines as
  few-shot context. Visible + deletable in the Guidelines window.

Two scopes, one storage table, one UI button. The system gets smarter
without conflating one-off edits with durable knowledge.
