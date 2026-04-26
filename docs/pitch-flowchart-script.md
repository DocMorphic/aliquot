# 30-second flowchart voiceover (backend video)

Read while the simplified `docs/architecture-simple.mmd` diagram is on
screen, animating one node at a time as you speak. Total ~75 words →
~30 seconds at 150 wpm.

---

## Script (5 beats, ~6 seconds each)

**Beat 1 — Hypothesis node lights up**
> A scientist types a hypothesis.

**Beat 2 — Validate node lights up**
> Aliquot validates it. If it's vague, the model rewrites it as a
> proper paragraph and asks "did you mean this?".

**Beat 3 — Lit QC node lights up**
> Once confirmed, we ground it in real literature.

**Beat 4 — Generate → Verify nodes light up in sequence**
> A grounded plan is generated, every catalog number is verified
> live, and per-claim confidence is scored.

**Beat 5 — Plan → Review loop animates**
> The scientist reviews. Per-experiment feedback edits this plan;
> general guidelines steer every future plan in the domain.

---

## How to render the diagram

1. Open <https://mermaid.live>
2. **Paste only the contents of `docs/architecture-simple.mmd`** —
   no markdown fences, no surrounding text.
3. Export → SVG (vector, scales to any video resolution).

To animate node-by-node in your video editor:
- Export 6 versions of the SVG, each with one more node visible
  (delete the line-arrow rules below the `--> Plan` chain
  progressively).
- Or, in the editor, mask each node with an opacity keyframe so it
  fades in on its beat.

## Word count

~75 words, 5 beats × ~6s = ~30s with normal pacing. Cut Beat 4 to
"Generated, verified, scored." if you want to land at 25s.
