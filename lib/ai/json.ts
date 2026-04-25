/**
 * Robust JSON extractor for LLM outputs. Sonnet usually returns clean JSON,
 * but occasionally wraps it in ```json fences, prepends "Here's the JSON:",
 * or trails commentary after the closing brace. This walker finds the first
 * balanced JSON object/array and parses it.
 *
 * Returns null on parse failure so callers can decide how to fall back
 * rather than throwing inside the pipeline.
 */
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  // Strip code fences first if present.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {
      // fall through to bracket walker
    }
  }

  // Find first {...} or [...] using a bracket-balanced walker so that
  // strings containing braces don't fool a naive regex.
  const start = firstBracket(raw);
  if (start === -1) return null;
  const end = matchingClose(raw, start);
  if (end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function firstBracket(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{" || s[i] === "[") return i;
  }
  return -1;
}

function matchingClose(s: string, start: number): number {
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
