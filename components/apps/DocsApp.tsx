"use client";

export function DocsApp() {
  return (
    <div className="flex flex-col gap-4 text-[13px]" style={{ lineHeight: 1.6 }}>
      <div>
        <h2
          className="font-display text-[26px]"
          style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Aliquot Docs
        </h2>
        <p className="mt-1" style={{ color: "var(--color-text-muted)" }}>
          Run the AI Scientist on your own machine, hit the HTTP API, or wire it up as an MCP tool.
        </p>
      </div>

      <Section title="Overview">
        <p>
          Aliquot is a Next.js app + a 3-phase pipeline:{" "}
          <strong>Phase 1</strong> (validator + classifier + literature QC, streamed via SSE),{" "}
          <strong>Phase 2</strong> (generator with grounded catalog lookups), and{" "}
          <strong>Phase 3</strong> (verifier + confidence scoring).
        </p>
        <p style={{ marginTop: 6 }}>
          Each phase is its own HTTP endpoint, so the UI is just one client. You can drive the same
          endpoints from a script, a Jupyter notebook, or an MCP server.
        </p>
      </Section>

      <Section title="1. Run locally">
        <p>Clone, install, drop in your keys, and you have a working pipeline.</p>
        <CodeBlock>{`git clone https://github.com/DocMorphic/aliquot
cd aliquot
cp .env.example .env.local
# fill in the four keys (see "Environment" below), then:
npm install
npm run dev
# open http://localhost:3000`}</CodeBlock>
        <p style={{ marginTop: 6 }}>
          Build a production bundle with <code>npm run build</code>; the same bundle ships to Vercel
          when you push to <code>main</code>.
        </p>
      </Section>

      <Section title="2. Environment">
        <p>Required keys in <code>.env.local</code>:</p>
        <CodeBlock>{`# Anthropic — Sonnet 4.6 (reasoning) + Haiku 4.5 (fast)
ANTHROPIC_API_KEY=sk-ant-...

# Tavily — catalog/spec search for materials grounding
TAVILY_API_KEY=tvly-...

# Supabase — plan persistence, references, corrections, file attachments
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # server-side only`}</CodeBlock>
        <p style={{ marginTop: 6 }}>
          Run the SQL from <code>supabase/schema.sql</code> in your Supabase project's SQL editor
          before the first request. Re-run it whenever the file changes — every migration block uses{" "}
          <code>add column if not exists</code> so it's safe to re-run.
        </p>
      </Section>

      <Section title="3. HTTP API">
        <p>
          Three endpoints, called in order. Phase 1 streams Server-Sent Events; Phases 2 + 3 return
          JSON. The base URL is whatever you deployed to (or <code>http://localhost:3000</code> in
          dev).
        </p>

        <h4
          className="mt-3 text-[11.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          PHASE 1 — POST /api/experiment/run
        </h4>
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

        <h4
          className="mt-3 text-[11.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          PHASE 2 — POST /api/experiment/:id/generate
        </h4>
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

        <h4
          className="mt-3 text-[11.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          PHASE 3 — POST /api/experiment/:id/verify
        </h4>
        <p>Verifier + confidence scoring. Returns the final plan, persisted to Supabase.</p>
        <CodeBlock>{`curl -X POST https://aliquot-pi.vercel.app/api/experiment/<id>/verify

# Response: { "plan": ExperimentPlan with verificationPending: false
#                                       and confidenceSummary populated }`}</CodeBlock>

        <h4
          className="mt-3 text-[11.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          OTHER ENDPOINTS
        </h4>
        <CodeBlock>{`GET    /api/experiments?limit=30           list recent runs
GET    /api/experiments/:id                 full plan + references
PATCH  /api/experiments/:id   { title }     rename for the Library
DELETE /api/experiments/:id                 remove + cascade

POST   /api/corrections                     save scientist feedback
                       { scope: 'experiment'|'general', ... }
GET    /api/guidelines                      list general guidelines
DELETE /api/guidelines/:id                  remove a stale one

POST   /api/uploads/file  (multipart)       attach a file as AI context`}</CodeBlock>
      </Section>

      <Section title="4. Wiring it up as an MCP server">
        <p>
          Wrap the API as a Model Context Protocol tool so Claude Desktop or Cursor can run experiments
          from inside a chat. Below is a stdio MCP server that exposes a single{" "}
          <code>run_aliquot_experiment</code> tool.
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

        <p style={{ marginTop: 8 }}>
          Add it to Claude Desktop's <code>~/.config/claude/claude_desktop_config.json</code>:
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
        <p style={{ marginTop: 6 }}>
          Restart Claude Desktop. Asking it to design an experiment will now route through Aliquot
          and return a fully grounded plan.
        </p>
      </Section>

      <Section title="5. Self-hosting on Vercel">
        <p>
          The repo is configured for Vercel out of the box. Push to a Vercel-connected GitHub repo,
          set the four env vars in the Vercel dashboard, and the same code path serves your domain.
          Generator + verify routes use <code>maxDuration = 120</code> so they fit Fluid Compute on
          the Pro tier; on Hobby a 55s in-process timeout returns a clean error before Vercel kills
          the function.
        </p>
      </Section>

      <Section title="Notes & limits">
        <ul className="ml-4 list-disc space-y-1">
          <li>Plans are persisted to Supabase. There's no auth — keep RLS open only on dev.</li>
          <li>Tavily quota: 1k searches/mo on the free tier; the generator caps at 8 reagent lookups per run.</li>
          <li>Anthropic spend per plan is roughly <code>$0.10–0.30</code> depending on hypothesis complexity.</li>
          <li>The <code>scope</code> field on corrections decides whether feedback is a one-off note or a domain-wide guideline. Only <code>scope: 'general'</code> rows are injected into future plans.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="mb-1.5 text-[10.5px] font-semibold tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {title.toUpperCase()}
      </h3>
      <div style={{ color: "var(--color-text-secondary)" }}>{children}</div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="custom-scrollbar mt-1.5 overflow-x-auto whitespace-pre border p-2 font-mono text-[10.5px]"
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
