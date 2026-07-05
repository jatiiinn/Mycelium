-- ============================================================
-- Mycelium — full database migration
-- Run this once in Supabase: Dashboard → SQL Editor → New query
-- Safe to re-run (everything is IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- Extensions -------------------------------------------------
create extension if not exists vector;      -- pgvector, for embeddings
create extension if not exists pgcrypto;    -- gen_random_uuid()

-- Helper: immutable array_to_string wrapper so it can be used
-- inside a generated column (the built-in is only STABLE).
create or replace function immutable_array_to_string(arr text[], sep text)
returns text
language sql immutable parallel safe
as $$ select array_to_string(arr, sep) $$;

-- Nodes table -------------------------------------------------
create table if not exists nodes (
  id                    uuid primary key default gen_random_uuid(),
  raindrop_id           bigint unique,                 -- null for manual adds
  source_type           text not null check (source_type in
                          ('instagram_post','instagram_reel','x_post',
                           'pinterest','link','image','manual_note')),
  source_url            text,
  title                 text not null default '',
  description           text,                          -- original caption / excerpt
  thumbnail_url         text,
  video_url             text,                          -- set only if a playable video was extracted
  transcript            text,                          -- Whisper output for videos
  ai_summary            text,                          -- 1–2 sentence AI summary
  tags                  text[] not null default '{}',
  tags_edited_by_user   boolean not null default false,
  embedding             vector(768),                   -- Gemini text-embedding-004
  enrichment_status     text not null default 'pending' check (enrichment_status in
                          ('pending','processing','done','failed')),
  enrichment_error      text,                          -- last error message, for debugging
  enrichment_attempts   int not null default 0,        -- retry counter (max 3 in worker)
  processing_started_at timestamptz,                   -- used to reclaim stuck jobs
  raw_payload           jsonb,                         -- original Raindrop API item
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Full-text search column (title + description + transcript + summary + tags)
alter table nodes add column if not exists fts tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(transcript, '') || ' ' ||
      coalesce(ai_summary, '') || ' ' ||
      immutable_array_to_string(tags, ' ')
    )
  ) stored;

-- Indexes ------------------------------------------------------
create index if not exists nodes_tags_gin      on nodes using gin (tags);
create index if not exists nodes_fts_gin       on nodes using gin (fts);
create index if not exists nodes_status_idx    on nodes (enrichment_status);
create index if not exists nodes_created_idx   on nodes (created_at desc);
-- HNSW vector index (Supabase ships pgvector >= 0.5, which supports hnsw)
create index if not exists nodes_embedding_hnsw on nodes
  using hnsw (embedding vector_cosine_ops);

-- updated_at trigger ------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists nodes_set_updated_at on nodes;
create trigger nodes_set_updated_at
  before update on nodes
  for each row execute function set_updated_at();

-- Sync state (single row) --------------------------------------
create table if not exists sync_state (
  id             int primary key default 1 check (id = 1),
  last_synced_at timestamptz not null default 'epoch',
  updated_at     timestamptz not null default now()
);
insert into sync_state (id) values (1) on conflict (id) do nothing;

-- RPC: combined search + tag filter + pagination ----------------
-- Used by the app for the homepage grid (empty query = "everything").
create or replace function search_nodes(
  query      text default '',
  tag_filter text default null,
  lim        int  default 100,
  off        int  default 0
)
returns table (
  id uuid, source_type text, source_url text, title text, description text,
  thumbnail_url text, video_url text, ai_summary text, tags text[],
  tags_edited_by_user boolean, enrichment_status text, enrichment_error text,
  created_at timestamptz
)
language sql stable as $$
  select n.id, n.source_type, n.source_url, n.title, n.description,
         n.thumbnail_url, n.video_url, n.ai_summary, n.tags,
         n.tags_edited_by_user, n.enrichment_status, n.enrichment_error,
         n.created_at
  from nodes n
  where (query is null or btrim(query) = ''
         or n.fts @@ websearch_to_tsquery('english', query))
    and (tag_filter is null or tag_filter = any(n.tags))
  order by
    case when query is null or btrim(query) = '' then null
         else ts_rank(n.fts, websearch_to_tsquery('english', query)) end
      desc nulls last,
    n.created_at desc
  limit lim offset off;
$$;

-- RPC: related saves by embedding distance -----------------------
create or replace function related_nodes(node_id uuid, match_count int default 6)
returns table (
  id uuid, source_type text, title text, thumbnail_url text,
  tags text[], enrichment_status text, distance double precision
)
language sql stable as $$
  select n.id, n.source_type, n.title, n.thumbnail_url, n.tags,
         n.enrichment_status,
         (n.embedding <=> t.embedding)::double precision as distance
  from nodes n,
       (select embedding from nodes where id = node_id) t
  where n.id <> node_id
    and n.embedding is not null
    and t.embedding is not null
  order by n.embedding <=> t.embedding
  limit match_count;
$$;

-- RPC: distinct tags with counts (for the filter dropdown) --------
create or replace function all_tags()
returns table (tag text, cnt bigint)
language sql stable as $$
  select t.tag, count(*)::bigint
  from nodes, unnest(tags) as t(tag)
  group by t.tag
  order by count(*) desc, t.tag asc;
$$;

-- Row Level Security ----------------------------------------------
-- The app and worker only ever talk to the DB with the SERVICE ROLE key
-- (server-side), which bypasses RLS. Enabling RLS with no policies means
-- the anon/public key can read NOTHING — which is what we want for a
-- private, single-user app.
alter table nodes enable row level security;
alter table sync_state enable row level security;

-- Storage bucket for uploaded images + extracted videos ------------
-- (If this insert fails due to permissions, create a PUBLIC bucket named
--  "mycelium" manually: Dashboard → Storage → New bucket.)
insert into storage.buckets (id, name, public)
values ('mycelium', 'mycelium', true)
on conflict (id) do nothing;
