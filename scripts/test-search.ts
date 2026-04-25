import { searchOpenAlex } from "../lib/search/openalex";
import { searchArxiv } from "../lib/search/arxiv";

async function main() {
  const q = "trehalose cryoprotectant HeLa cells";
  console.log(`Query: "${q}"\n`);

  console.log("--- OpenAlex ---");
  try {
    const a = await searchOpenAlex(q, 3);
    console.log(`Got ${a.length} results`);
    a.slice(0, 3).forEach((r, i) => {
      console.log(`  [${i}] ${r.title}`);
      console.log(`      ${r.authors.slice(0, 3).join(", ")} (${r.year ?? "?"})`);
    });
  } catch (e) {
    console.log("OpenAlex error:", (e as Error).message);
  }

  console.log("\n--- arXiv ---");
  try {
    const a = await searchArxiv(q, 3);
    console.log(`Got ${a.length} results`);
    a.slice(0, 2).forEach((r, i) => {
      console.log(`  [${i}] ${r.title}`);
    });
  } catch (e) {
    console.log("arXiv error:", (e as Error).message);
  }
}

main();
