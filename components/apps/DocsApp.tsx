"use client";

import { useState } from "react";

type SectionId =
  | "overview"
  | "run-locally"
  | "environment"
  | "http-api"
  | "mcp"
  | "self-hosting"
  | "limits";

interface SectionDef {
  id: SectionId;
  label: string;
  group: string;
}

const SECTIONS: SectionDef[] = [
  { id: "overview", label: "Overview", group: "Getting started" },
  { id: "run-locally", label: "Run locally", group: "Getting started" },
  { id: "environment", label: "Environment", group: "Getting started" },
  { id: "http-api", label: "HTTP API", group: "Integrations" },
  { id: "mcp", label: "MCP integration", group: "Integrations" },
  { id: "self-hosting", label: "Self-host on Vercel", group: "Operations" },
  { id: "limits", label: "Notes & limits", group: "Operations" },
];

export function DocsApp() {
  const [active, setActive] = useState<SectionId>("overview");

  // Group sections for the sidebar.
  const groups = SECTIONS.reduce<Record<string, SectionDef[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex h-full">
      <nav
        className="custom-scrollbar shrink-0 overflow-y-auto border-r"
        style={{
          width: 180,
          background: "var(--color-surface-alt)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="px-3 pt-3 pb-2">
          <h2
            className="font-display text-[18px]"
            style={{ fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Aliquot Docs
          </h2>
          <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--color-text-muted)" }}>
            Run it, hit the API, ship it.
          </p>
        </div>

        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="mb-3 px-2">
            <div
              className="px-2 pb-1 text-[10px] font-semibold tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {group.toUpperCase()}
            </div>
            <ul className="space-y-0.5">
              {items.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActive(s.id)}
                    className="w-full px-2 py-1 text-left text-[12px] transition-colors"
                    style={{
                      background:
                        active === s.id ? "var(--color-accent)" : "transparent",
                      color:
                        active === s.id ? "white" : "var(--color-text-secondary)",
                      borderRadius: 4,
                      fontWeight: active === s.id ? 600 : 500,
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <main
        className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4 text-[13px]"
        style={{ lineHeight: 1.65, color: "var(--color-text-secondary)" }}
      >
        {active === "overview" && <Overview />}
        {active === "run-locally" && <RunLocally />}
        {active === "environment" && <Environment />}
        {active === "http-api" && <HttpApi />}
        {active === "mcp" && <McpIntegration />}
        {active === "self-hosting" && <SelfHosting />}
        {active === "limits" && <Limits />}
      </main>
    </div>
  );
}

// ============================================================
// Section content
// ============================================================

function Overview() {
  return (
    <Article title="Overview">
      <p>
        Aliquot is a Next.js app + a 3-phase pipeline that turns a plain-language
        scientific hypothesis into an operationally realistic experiment plan with
        real catalog numbers, citations, budget, timeline, and confidence scores.
      </p>
      <p>The pipeline:</p>
      <ol>
        <li>
          <strong>Phase 1</strong> — validator → classifier → literature QC. Streamed
          via Server-Sent Events. Persists an experiment row.
        </li>
        <li>
          <strong>Phase 2</strong> — generator with grounded Tavily catalog lookups
          and Anthropic content blocks for any user-uploaded files.
        </li>
        <li>
          <strong>Phase 3</strong> — verifier re-checks every catalog number and a
          Haiku pass annotates per-claim confidence (0–100%).
        </li>
      </ol>
      <p>
        Each phase is its own HTTP endpoint, so the UI is just one client. You can
        drive the same endpoints from a script, a notebook, or an MCP server.
      </p>
    </Article>
  );
}

function RunLocally() {
  return (
    <Article title="Run locally">
      <p>Clone, install, drop in your keys, and you have a working pipeline.</p>
      <CodeBlock>{`git clone https://github.com/DocMorphic/aliquot
cd aliquot
cp .env.example .env.local
# fill in the four keys (see "Environment"), then:
npm install
npm run dev
# open http://localhost:3000`}</CodeBlock>
      <p>
        Build a production bundle with <code>npm run build</code>; the same bundle
        ships to Vercel when you push to <code>main</code>.
      </p>
      <p>
        Run the SQL from <code>supabase/schema.sql</code> in your Supabase project&apos;s
        SQL editor before the first request. Re-run it whenever the file changes —
        every migration block uses <code>add column if not exists</code> so it&apos;s safe.
      </p>
    </Article>
  );
}

function Environment() {
  return (
    <Article title="Environment">
      <p>Required keys in <code>.env.local</code>:</p>
      <CodeBlock>{`# Anthropic — Sonnet 4.6 (reasoning) + Haiku 4.5 (fast)
ANTHROPIC_API_KEY=sk-ant-...

# Tavily — catalog/spec search for materials grounding
TAVILY_API_KEY=tvly-...

# Supabase — plan persistence, references, corrections, file attachments
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # server-side only`}</CodeBlock>
      <p>
        The service-role key bypasses RLS, so don&apos;t expose it in any client bundle.
        RLS is currently open on read; lock it down before any real launch.
      </p>
    </Article>
  );
}

function HttpApi() {
  return (
    <Article title="HTTP API">
      <p>
        Three endpoints, called in order. Phase 1 streams Server-Sent Events;
        Phases 2 + 3 return JSON. Base URL is whatever you deployed to (or{" "}
        <code>http://localhost:3000</code> in dev).
      </p>

      <SubHeader>Phase 1 — POST /api/experiment/run</SubHeader>
      <p>Validator → classifier → lit QC. Streams events; persists an experiment row.</p>
      <CodeBlock>{`curl -N -X POST https://aliquot-pi.vercel.app/api/experiment/run \\
  -H "Content-Type: application/json" \\
  -d '{
    "hypothesis": "Metformin extends yeast lifespan via AMPK",
    "currency": "USD",
    "attachments": []
  }'

# Event types you'll see (each as: data: {...})
#   stage              { stage, message }
#   needs_refinement   { reason, suggestions }   ← prompt was too vague
#   needs_confirmation { reason, refined, original }
#   lit_qc             { novelty, references }
#   experiment_started { experimentId, domain }  ← grab this
#   error              { message }`}</CodeBlock>

      <SubHeader>Phase 2 — POST /api/experiment/:id/generate</SubHeader>
      <p>Generator. Returns the draft plan with <code>verificationPending: true</code>.</p>
      <CodeBlock>{`curl -X POST https://aliquot-pi.vercel.app/api/experiment/<id>/generate \\
  -H "Content-Type: application/json" \\
  -d '{ "currency": "USD" }'

# Response: { "plan": ExperimentPlan }
# ExperimentPlan = {
#   domain, protocol[], materials[], equipment[],
#   budget, timeline[], validation[], caveats[],
#   verificationPending: true, runStats: { durationMs, ... }
# }`}</CodeBlock>

      <SubHeader>Phase 3 — POST /api/experiment/:id/verify</SubHeader>
      <p>Verifier + confidence scoring. Returns the final plan, persisted to Supabase.</p>
      <CodeBlock>{`curl -X POST https://aliquot-pi.vercel.app/api/experiment/<id>/verify

# Response: { "plan": ExperimentPlan with verificationPending: false
#                                       and confidenceSummary populated }`}</CodeBlock>

      <SubHeader>Other endpoints</SubHeader>
      <CodeBlock>{`GET    /api/experiments?limit=30           list recent runs
GET    /api/experiments/:id                 full plan + references
PATCH  /api/experiments/:id   { title }     rename for the Library
DELETE /api/experiments/:id                 remove + cascade

POST   /api/corrections                     save scientist feedback
                       { scope: 'experiment'|'general', ... }
GET    /api/guidelines                      list general guidelines
DELETE /api/guidelines/:id                  remove a stale one

POST   /api/uploads/file  (multipart)       attach a file as AI context`}</CodeBlock>
    </Article>
  );
}

function McpIntegration() {
  return (
    <Article title="MCP integration">
      <p>
        Wrap the API as a Model Context Protocol tool so Claude Desktop or Cursor
        can run experiments from inside a chat. Below is a stdio MCP server that
        exposes a single <code>run_aliquot_experiment</code> tool.
      </p>

      <CodeBlock>{`// mcp-aliquot.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE = process.env.ALIQUOT_BASE ?? "https://aliquot-pi.vercel.app";

const server = new Server(
  { name: "aliquot", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_aliquot_experiment",
      description:
        "Generate a grounded experiment plan from a scientific hypothesis. " +
        "Returns protocol, materials with catalog #s, budget, timeline, " +
        "validation, and confidence scores.",
      inputSchema: {
        type: "object",
        properties: {
          hypothesis: { type: "string" },
          currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
        },
        required: ["hypothesis"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "run_aliquot_experiment") {
    throw new Error("unknown tool");
  }
  const { hypothesis, currency = "USD" } = req.params.arguments as {
    hypothesis: string;
    currency?: string;
  };

  // 1. Phase 1 — stream until experiment_started.
  const r1 = await fetch(\`\${BASE}/api/experiment/run\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hypothesis, currency }),
  });
  const reader = r1.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let experimentId: string | null = null;
  while (!experimentId) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const evt of buffer.split("\\n\\n")) {
      const line = evt.split("\\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.type === "experiment_started") experimentId = payload.experimentId;
    }
  }
  if (!experimentId) throw new Error("Phase 1 ended without experiment_started");

  // 2. Phase 2 — generate.
  const r2 = await fetch(\`\${BASE}/api/experiment/\${experimentId}/generate\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currency }),
  });
  if (!r2.ok) throw new Error(\`generate HTTP \${r2.status}\`);

  // 3. Phase 3 — verify.
  const r3 = await fetch(\`\${BASE}/api/experiment/\${experimentId}/verify\`, {
    method: "POST",
  });
  const { plan } = await r3.json();

  return {
    content: [{ type: "text", text: JSON.stringify(plan, null, 2) }],
  };
});

await server.connect(new StdioServerTransport());`}</CodeBlock>

      <p>
        Add it to Claude Desktop&apos;s <code>~/.config/claude/claude_desktop_config.json</code>:
      </p>
      <CodeBlock>{`{
  "mcpServers": {
    "aliquot": {
      "command": "tsx",
      "args": ["/absolute/path/to/mcp-aliquot.ts"],
      "env": { "ALIQUOT_BASE": "https://aliquot-pi.vercel.app" }
    }
  }
}`}</CodeBlock>
      <p>
        Restart Claude Desktop. Asking it to design an experiment will now route
        through Aliquot and return a fully grounded plan.
      </p>
    </Article>
  );
}

function SelfHosting() {
  return (
    <Article title="Self-host on Vercel">
      <p>
        The repo is configured for Vercel out of the box. Push to a Vercel-connected
        GitHub repo, set the four env vars in the Vercel dashboard, and the same code
        path serves your domain.
      </p>
      <p>
        Generator + verify routes use <code>maxDuration = 120</code> so they fit
        Fluid Compute on the Pro tier. On Hobby a 55s in-process timeout returns a
        clean error before Vercel kills the function.
      </p>
      <CodeBlock>{`# Vercel CLI flow
npx vercel link
npx vercel env add ANTHROPIC_API_KEY production
npx vercel env add TAVILY_API_KEY production
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
git push origin main   # deploy`}</CodeBlock>
    </Article>
  );
}

function Limits() {
  return (
    <Article title="Notes & limits">
      <ul>
        <li>Plans are persisted to Supabase. There&apos;s no auth — keep RLS open only on dev.</li>
        <li>
          Tavily quota: 1k searches/mo on the free tier; the generator caps at 8
          reagent lookups per run.
        </li>
        <li>
          Anthropic spend per plan is roughly <code>$0.10–0.30</code> depending on
          hypothesis complexity.
        </li>
        <li>
          The <code>scope</code> field on corrections decides whether feedback is a
          one-off note or a domain-wide guideline. Only <code>scope: &apos;general&apos;</code>{" "}
          rows are injected into future plans.
        </li>
        <li>
          The Hypothesis window accepts up to 3 file attachments (PDF, image, or
          plain text), 4 MB each. PDFs and images are sent as native Anthropic
          content blocks; text files inline as text (truncated at 60 KB).
        </li>
      </ul>
    </Article>
  );
}

// ============================================================
// Layout helpers
// ============================================================

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="docs-article space-y-3">
      <h2
        className="font-display text-[24px]"
        style={{ fontWeight: 500, letterSpacing: "-0.02em", color: "var(--color-text)" }}
      >
        {title}
      </h2>
      {children}
    </article>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mt-4 text-[11.5px] font-semibold tracking-wider"
      style={{ color: "var(--color-text-muted)" }}
    >
      {String(children).toUpperCase()}
    </h3>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="custom-scrollbar overflow-x-auto whitespace-pre border p-2.5 font-mono text-[10.5px]"
      style={{
        background: "var(--color-surface-alt)",
        borderColor: "var(--color-border)",
        borderRadius: 4,
        color: "var(--color-text)",
        lineHeight: 1.5,
      }}
    >
      {children}
    </pre>
  );
}
