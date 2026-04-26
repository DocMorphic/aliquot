-- Bench OS — Supabase schema
-- Run inside the Supabase SQL editor (or via `supabase db push` once linked).
-- Requires the `vector` extension for pgvector embedding similarity.

create extension if not exists vector;

-- ===== experiments =====
create table if not exists experiments (
  id uuid primary key default gen_random_uuid(),
  hypothesis text not null,
  domain text,
  status text not null default 'queued',
  novelty text,
  title text,
  created_at timestamptz default now()
);
-- v14 migration for existing tables: add the title column if missing.
alter table experiments add column if not exists title text;
create index if not exists idx_experiments_created on experiments (created_at desc);

-- ===== plans =====
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid references experiments(id) on delete cascade,
  version int not null default 1,
  plan_json jsonb not null,
  embedding vector(1536),
  confidence_summary jsonb,
  agent_runs jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_plans_experiment on plans (experiment_id);
create index if not exists idx_plans_embedding on plans
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ===== references_found =====
create table if not exists references_found (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid references experiments(id) on delete cascade,
  doi text,
  url text,
  title text,
  authors text[],
  year int,
  source text,
  similarity float
);
create index if not exists idx_refs_experiment on references_found (experiment_id);

-- ===== corrections (stretch goal) =====
create table if not exists corrections (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  domain text not null,
  section_path text not null,
  original text,
  corrected text,
  rationale text,
  rating int,
  -- 'experiment' = note about this run only (audit trail; never injected
  -- into future plans). 'general' = guideline applied to every future
  -- plan in this domain.
  scope text not null default 'experiment',
  embedding vector(1536),
  created_at timestamptz default now()
);
-- v15 migration for existing rows: backfill missing column.
alter table corrections add column if not exists scope text not null default 'experiment';
create index if not exists idx_corrections_domain on corrections (domain);
create index if not exists idx_corrections_scope on corrections (scope);
create index if not exists idx_corrections_embedding on corrections
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ===== experiment_files (user-uploaded attachments) =====
create table if not exists experiment_files (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid references experiments(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  file_size bigint,
  uploaded_at timestamptz default now()
);
create index if not exists idx_experiment_files_experiment on experiment_files (experiment_id);

-- ===== Row Level Security =====
-- Hackathon scope: keep RLS open so anon key can read references + plans.
-- Lock down before any real launch.
alter table experiments enable row level security;
alter table plans enable row level security;
alter table references_found enable row level security;
alter table corrections enable row level security;
alter table experiment_files enable row level security;

-- Anyone can read (anon key)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'public_read_experiments') then
    create policy public_read_experiments on experiments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'public_read_plans') then
    create policy public_read_plans on plans for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'public_read_refs') then
    create policy public_read_refs on references_found for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'public_read_corrections') then
    create policy public_read_corrections on corrections for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'public_read_experiment_files') then
    create policy public_read_experiment_files on experiment_files for select using (true);
  end if;
end $$;
-- Writes only via service role (default; service role bypasses RLS).
