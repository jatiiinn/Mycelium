# Mycelium

A private, single-user inspiration dump. Save things from Instagram, X, and
Pinterest via Raindrop (or add links/images/notes directly) and they show up in
a dark, Pinterest-style masonry grid — automatically titled, thumbnailed,
tagged, summarized, transcribed (for reels), and embedded for "related saves".

## The three parts

| Part | Where it runs | What it does |
|---|---|---|
| **Next.js app** (this repo's root) | Vercel | The UI (grid, search, tag filter, detail view, manual add, passcode gate) + API routes, including `/api/sync` which pulls new saves from Raindrop |
| **Worker** (`/worker`) | Render (Docker) | Enrichment: OG metadata, yt-dlp + ffmpeg + Groq Whisper transcription, Gemini tags/summary/embeddings |
| **Database + storage** | Supabase | Postgres (with pgvector) holding all nodes, plus a public `mycelium` storage bucket for uploaded images and extracted videos |

## How data flows (save → visible on homepage)

1. You save a reel/post/pin with Raindrop's share sheet or extension.
2. Every 10 minutes, `/api/sync` asks Raindrop for anything created after the
   last synced timestamp (tracked in the `sync_state` table) and inserts new
   rows into `nodes` with `enrichment_status = 'pending'`, inferring
   `source_type` from the URL. (Manual adds via the **+** button insert
   `pending` rows directly, skipping Raindrop.)
3. The card appears on the homepage immediately with a shimmering tag row —
   the grid quietly polls while anything is pending.
4. The Render worker (polling every minute) claims the pending node, marks it
   `processing`, does OG lookup → video/transcript (reels) → Gemini tags +
   summary → Gemini embedding, then marks it `done`.
5. On the next poll the shimmer resolves into tag pills. Opening the card shows
   the video/image, transcript, AI summary, editable tags, source link, and the
   6 nearest saves by embedding distance.

Failure handling: video downloads that fail (private/deleted posts) don't stop
tagging; nodes failing 3 times are marked `failed` with the error stored, shown
in the UI with a **Retry** button; jobs stuck `processing` >10 min are re-queued.
Tags you edit by hand set `tags_edited_by_user` and are never auto-overwritten.

## Setup — do these in order

### 1. Supabase (~5 min)

1. Create a project at https://supabase.com (free tier is fine).
2. Open **SQL Editor → New query**, paste the whole contents of
   `supabase/migration.sql`, run it. This creates the tables, indexes, search
   functions, and a public storage bucket named `mycelium`. (If the last
   statement errors about storage permissions, create the bucket manually:
   **Storage → New bucket → name `mycelium` → Public**.)
3. From **Project Settings → API**, copy: the **Project URL**, the **anon**
   key, and the **service_role** key. You'll paste these into Vercel and Render.

### 2. Raindrop token (~2 min)

1. Go to https://app.raindrop.io → **Settings → Integrations → For Developers →
   Create new app**.
2. Open the app you created and click **Create test token**. Copy it — that's
   your `RAINDROP_TOKEN`. (A test token is all you need for personal use.)

### 3. API keys (~3 min)

- **Groq:** https://console.groq.com → API Keys → Create. Free tier covers
  Whisper transcription comfortably for personal volume.
- **Gemini:** https://aistudio.google.com → **Get API key**. Free tier covers
  tagging + embeddings for personal volume.

### 4. Deploy the app to Vercel (~5 min)

1. Push this repo to GitHub.
2. https://vercel.com → **Add New → Project** → import the repo. Framework is
   auto-detected (Next.js); leave the root directory as the repo root.
3. Before/after the first deploy, open the project's **Settings →
   Environment Variables** and add (all environments):

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_ANON_KEY` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 (secret) |
   | `RAINDROP_TOKEN` | from step 2 |
   | `MYCELIUM_PASSCODE` | any passcode you want to type to unlock the app |
   | `CRON_SECRET` | a long random string (e.g. from https://1password.com/password-generator or `openssl rand -hex 24`) |

4. Redeploy (Deployments → ⋯ → Redeploy) so the env vars take effect.
5. `vercel.json` registers a **daily** cron hitting `/api/sync` (Vercel's free
   Hobby plan rejects deploys with more-frequent crons). The every-10-minutes
   syncing is done by the Render worker instead — set `SYNC_URL` +
   `CRON_SECRET` on the worker (step 5) and syncing runs every 10 minutes
   reliably. (If you ever upgrade to Vercel Pro, you can change the schedule in
   `vercel.json` back to `*/10 * * * *`.)

### 5. Deploy the worker to Render

Follow `worker/README.md` — it's step-by-step, including why it uses Docker
(yt-dlp and ffmpeg aren't in Render's stock Node environment) and a note on
Render pricing/free-tier options.

### 6. Test the whole pipeline end to end (~5 min)

1. Visit your Vercel URL → you should hit the passcode page → enter
   `MYCELIUM_PASSCODE` → empty-state homepage.
2. Save any public Instagram reel to Raindrop with the share sheet.
3. Force a sync immediately instead of waiting:
   open `https://YOUR-APP.vercel.app/api/sync?secret=YOUR_CRON_SECRET` in a
   browser. You should see `{"synced":1}`.
4. Refresh the homepage — the card is there with a shimmering tag row.
5. Watch the Render worker **Logs**: `processing node … → done`. Within a
   minute or two the shimmer becomes tags.
6. Click the card: AI summary, tags (try editing them), transcript if the
   download succeeded, link to the original, and — once you have a few saves —
   related items.
7. Also try the **+** button: paste a link, upload an image, write a note.

## Environment variable reference

Web app (Vercel): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `RAINDROP_TOKEN`, `MYCELIUM_PASSCODE`,
`CRON_SECRET`.
Worker (Render): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`,
`GEMINI_API_KEY`, `SYNC_URL`, `CRON_SECRET`, and optional `GEMINI_MODEL`,
`MAX_VIDEO_MB`, `YTDLP_EXTRA_ARGS`.

`CRON_SECRET` is one extra variable beyond your original list — it's the shared
secret that stops strangers from triggering `/api/sync` (the spec's "secret
query param"); set the same value in both Vercel and Render.

## Notes & known limits

- **Instagram downloads:** Instagram often blocks anonymous downloading. When
  that happens the reel is still tagged/summarized from its caption — see
  `worker/README.md` for the optional cookies workaround.
- **Search** is Postgres full-text (title, caption, transcript, summary, tags).
  Semantic search and the **Graph** view are phase 2 — the header toggle is a
  disabled placeholder as requested.
- **Security model:** all data access goes through server-side API routes using
  the Supabase service-role key; RLS is enabled with no policies, so the anon
  key can read nothing. The app itself is gated by your passcode via an
  httpOnly cookie checked in middleware. No localStorage/sessionStorage is used
  anywhere.
- **Styling** follows the supplied homepage reference: white editorial canvas,
  hairline rules, small monochrome type, numbered items (`001`, `002`, …), a
  centered `Grid / Graph` switch (Graph disabled until phase 2), and quiet
  search/tag controls. All functionality is unchanged.
- Local development: `cp .env.example .env.local`, fill it in, `npm install`,
  `npm run dev` (root), and see `worker/README.md` for running the worker
  locally.
