import { getAnthropic } from "../client";
import { MODELS } from "@/lib/constants";
import type { Domain } from "@/lib/types";

const SYSTEM = `You are a scientific domain classifier for an experiment-planning tool.

Given a scientific hypothesis written in plain language, return EXACTLY ONE of these labels (no extra text, no punctuation):

biology
chemistry
physics
climate

Routing rules:
- biology — wet lab, cells, animals, antibodies, microbiology, immunology, neuroscience, gut/microbiome, diagnostics on biological samples
- chemistry — synthesis, catalysis, materials chemistry, analytical chemistry, NOT biology
- physics — optics, quantum, condensed matter, particle, fluids
- climate — climate, energy, carbon capture, renewable systems, ecosystem-scale

When in doubt between biology and chemistry, prefer biology. When the hypothesis spans multiple domains, choose the one whose techniques dominate the experiment.`;

export async function classifyDomain(hypothesis: string): Promise<Domain> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 8,
    system: SYSTEM,
    messages: [{ role: "user", content: hypothesis }],
  });

  const block = res.content[0];
  const text = block?.type === "text" ? block.text.trim().toLowerCase() : "";
  const m = text.match(/biology|chemistry|physics|climate/);
  if (m) return m[0] as Domain;
  // Fallback — biology covers ~75% of likely hackathon prompts.
  return "biology";
}
