/**
 * Seed the corrections table with plausible expert feedback so the
 * feedback-loop demo isn't cold on first run. Generator's
 * get_corrections tool will retrieve these for any domain match.
 *
 * Run with:
 *   npx tsx scripts/seed-corrections.ts
 *
 * Idempotent: skips inserts if a correction with the same domain +
 * section_path + corrected text already exists.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { SEED_CORRECTIONS } from "../lib/supabase/seed-corrections";

// Load .env.local manually (server-only secrets, not bundled by Next).
config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Check what's already there.
  const { data: existing, error: existingErr } = await sb
    .from("corrections")
    .select("domain, section_path, corrected");
  if (existingErr) {
    console.error("Failed to read existing corrections:", existingErr.message);
    process.exit(1);
  }
  const existingSet = new Set(
    (existing ?? []).map(
      (e) => `${e.domain}|${e.section_path}|${e.corrected.slice(0, 60)}`
    )
  );

  const toInsert = SEED_CORRECTIONS.filter(
    (c) =>
      !existingSet.has(`${c.domain}|${c.sectionPath}|${c.corrected.slice(0, 60)}`)
  ).map((c) => ({
    plan_id: null,
    domain: c.domain,
    section_path: c.sectionPath,
    original: c.original,
    corrected: c.corrected,
    rationale: c.rationale,
    rating: c.rating,
  }));

  if (toInsert.length === 0) {
    console.log(`✓ All ${SEED_CORRECTIONS.length} seed corrections already present.`);
    return;
  }

  const { error } = await sb.from("corrections").insert(toInsert);
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }
  console.log(`✓ Seeded ${toInsert.length} new corrections (skipped ${SEED_CORRECTIONS.length - toInsert.length} duplicates).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
