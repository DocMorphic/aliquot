# 30-second flowchart voiceover (backend video)

Read while the simplified `docs/architecture-simple.mmd` diagram is on
screen, animating one node at a time as you speak. Total ~80 words →
~32 seconds at 150 wpm.

---

## Script (5 beats)

**Beat 1 — Hypothesis + Validate light up (~7s)**
> A scientist types a hypothesis. The validator catches vague input
> and rewrites it into a proper paragraph for the user to confirm.

**Beat 2 — Classify + Lit QC + OpenAlex light up (~6s)**
> A classifier picks the domain. Lit QC pulls grounded references
> from OpenAlex.

**Beat 3 — Generate node lights up with Tavily and Guidelines arrows (~7s)**
> The generator drafts a plan, grounded by parallel Tavily catalog
> searches, and steered by domain-specific guidelines from prior
> reviews.

**Beat 4 — Verify + Confidence + Plan light up (~6s)**
> Every catalog number is re-verified live. A confidence pass scores
> each claim. The plan is delivered.

**Beat 5 — Review loop animates: Reviser feedback + Guidelines branch (~6s)**
> The scientist reviews. Per-experiment notes route through the
> reviser to edit this plan. General guidelines steer every future
> plan in the domain. Supabase persists it all.

---

## How to render the diagram

1. Open <https://mermaid.live>
2. **Paste only the contents of `docs/architecture-simple.mmd`** —
   no markdown fences, no surrounding text.
3. Export → SVG (vector, scales to any video resolution).

To animate node-by-node in your video editor:
- Export 5 versions of the SVG, each with one more group of nodes
  visible (delete the trailing arrow rules progressively).
- Or, in the editor, mask each node group with an opacity keyframe so
  it fades in on its beat.

## Word count

~80 words, 5 beats × ~6.5s = ~32s with normal pacing. Drop "from prior
reviews" in Beat 3 and "Supabase persists it all" in Beat 5 to land at
~25s.
