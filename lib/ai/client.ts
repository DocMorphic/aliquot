import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Copy .env.local.example to .env.local and fill it in."
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

/**
 * The system prompt block that is shared across all Sonnet agents in the
 * pipeline. Mark it with cache_control so the SDK + API cache it for the
 * 5-minute TTL — every additional agent call inside one experiment hits a
 * cached prefix and pays ~10% of normal input cost.
 *
 * To add a new shared block (e.g. a long taxonomy reference, few-shot
 * exemplars), append it here and Anthropic will cache the whole prefix.
 */
export function cachedSystemBlock(content: string): Array<{
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}> {
  return [{ type: "text", text: content, cache_control: { type: "ephemeral" } }];
}
