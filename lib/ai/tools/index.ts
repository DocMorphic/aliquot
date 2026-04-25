// =====================================================================
// Aliquot — tool definitions for the Generator agent
// =====================================================================
// These are the tool schemas + handler signatures the Generator agent
// can call during plan synthesis. Anthropic SDK tool use format.
//
// STATUS: schemas defined, handlers are stubs that delegate to lib/search
// and lib/supabase modules.

import type Anthropic from "@anthropic-ai/sdk";

export const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_protocols",
    description:
      "Search published protocols on protocols.io for grounded methodology. Returns up to 5 relevant protocols with title, abstract, DOI, and step count. Use this when drafting protocol steps.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language description of the methodology you need to ground.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_catalog",
    description:
      "Search supplier catalogs (Sigma-Aldrich, Thermo Fisher, Promega, Qiagen, IDT, ATCC, Addgene, etc.) for a specific reagent. Returns catalog number, supplier, price, and product URL. Use this for every material entry — never invent catalog numbers.",
    input_schema: {
      type: "object",
      properties: {
        reagent: {
          type: "string",
          description:
            "Specific reagent name including clone, isotype, conjugate, or grade where applicable (e.g. 'anti-CRP IgG, clone C7, mouse mAb' rather than 'antibody').",
        },
      },
      required: ["reagent"],
    },
  },
  {
    name: "search_suppliers",
    description:
      "Compare 2-3 suppliers for a single reagent for cost-optimization. Returns supplier name, catalog number, unit price, and lead time so you can pick the cheapest in-stock option. Use after search_catalog narrows down to a known reagent.",
    input_schema: {
      type: "object",
      properties: {
        reagent: { type: "string" },
        catalogHint: {
          type: "string",
          description: "Optional catalog # already found, to anchor cross-supplier search.",
        },
      },
      required: ["reagent"],
    },
  },
  {
    name: "get_corrections",
    description:
      "Retrieve up to 5 most-similar past corrections from scientist reviews in this domain. Use these as few-shot examples to avoid repeating mistakes. Each correction shows what was originally generated and what the scientist corrected it to.",
    input_schema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["biology", "chemistry", "physics", "climate"],
        },
        hypothesis: { type: "string" },
      },
      required: ["domain", "hypothesis"],
    },
  },
];

// === Handler signatures (stubs) ===

export async function handleSearchProtocols(_input: { query: string }) {
  throw new Error("TODO: protocols.io API client in lib/search/protocols-io.ts");
}

export async function handleSearchCatalog(_input: { reagent: string }) {
  throw new Error("TODO: Tavily search + catalog # extraction in lib/search/tavily.ts");
}

export async function handleSearchSuppliers(_input: {
  reagent: string;
  catalogHint?: string;
}) {
  throw new Error("TODO: Tavily multi-supplier compare in lib/search/tavily.ts");
}

export async function handleGetCorrections(_input: {
  domain: string;
  hypothesis: string;
}) {
  throw new Error("TODO: Supabase pgvector similarity query");
}
