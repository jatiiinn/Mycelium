# Mycelium worker (deploy to Render)

This is the enrichment service. It polls Supabase for nodes with
`enrichment_status = 'pending'` and, for each one:

1. Fills in missing title/description/thumbnail from the page's Open Graph tags.
2. For Instagram reels (or anything with a video), downloads the video with
   **yt-dlp**, extracts audio with **ffmpeg**, and transcribes it with
   **Groq Whisper**. If the download fails (private/deleted post, rate limit),
   it logs the failure and continues without a transcript.
3. Asks **Gemini** for 3–6 tags and a 1–2 sentence summary (vision model for
   uploaded images). Nodes whose tags you've edited by hand are never re-tagged.
4. Generates a 768-dim **Gemini embedding** and stores it.
5. Marks the node `done` (or `failed` after 3 attempts, with the error saved).
   Jobs stuck in `processing` for more than 10 minutes are re-queued automatically.

It also (optionally) calls your Vercel `/api/sync` endpoint every 10 minutes —
see `SYNC_URL` below. This matters because **Vercel's free Hobby plan only runs
cron jobs about once per day**; with `SYNC_URL` set, Raindrop syncing works
every 10 minutes regardless of your Vercel plan.

## Why Docker?

Render's default Node environment does **not** include yt-dlp or ffmpeg, and you
can't `apt-get install` on it. The included `Dockerfile` installs both, so
deploy this folder as a **Docker** service — no manual installation needed.

## Deploy steps (one time, ~10 minutes)

1. Push the whole `mycelium` repo to GitHub (the worker lives in `/worker`).
2. Go to https://dashboard.render.com → **New → Background Worker**
   (or **Web Service** — see "Cost note" below).
3. Connect the GitHub repo.
4. Settings:
   - **Root Directory:** `worker`
   - **Runtime / Environment:** `Docker` (Render auto-detects the Dockerfile
     once the root directory is set)
   - **Instance type:** the smallest paid instance is fine (this is a light
     workload; it only spikes briefly when a video downloads)
5. Add these **Environment Variables** in Render's dashboard
   (Environment tab → Add Environment Variable):

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | from Supabase → Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | same page (the **service_role** secret, not anon) |
   | `GROQ_API_KEY` | from console.groq.com → API Keys |
   | `GEMINI_API_KEY` | from aistudio.google.com → Get API key |
   | `SYNC_URL` | `https://YOUR-APP.vercel.app/api/sync` (set after Vercel deploy) |
   | `CRON_SECRET` | the SAME random string you set in Vercel |
   | `GEMINI_MODEL` | *(optional)* defaults to `gemini-2.5-flash-lite` |
   | `MAX_VIDEO_MB` | *(optional)* defaults to `60` |
   | `YTDLP_EXTRA_ARGS` | *(optional)* see Instagram note below |

6. Click **Create**. Render builds the Docker image and starts the worker.
   Check the **Logs** tab — you should see `mycelium worker started`.

## Cost note (Render free tier)

Render **Background Workers are paid only** (~$7/mo starter). If you want to
stay on the free tier, deploy this as a **Web Service** instead — the worker
already serves a health endpoint on `$PORT` so it passes Render's port check.
Caveat: free web services **spin down after ~15 minutes of no inbound
traffic**, which pauses enrichment until something pings it. A free uptime
pinger (e.g. an UptimeRobot monitor hitting your Render URL every 5 minutes)
keeps it awake. The paid background worker is the zero-fuss option.

## Instagram download caveat

Instagram frequently blocks anonymous downloads (yt-dlp errors like
"login required" or rate limits). The pipeline is built for this: the node
still gets tagged and summarized from its caption, just without a transcript.
If it bothers you, you can export your browser's Instagram cookies to a
`cookies.txt` file, add it in Render as a **Secret File** (e.g. mounted at
`/etc/secrets/cookies.txt`), and set:

```
YTDLP_EXTRA_ARGS=--cookies /etc/secrets/cookies.txt
```

## Running locally (optional)

```bash
cd worker
cp .env.example .env   # fill in values
npm install
# you need yt-dlp + ffmpeg on your machine for video steps:
#   macOS: brew install yt-dlp ffmpeg
npm run dev
```

(Node's `--env-file` flag or a shell exporter is needed for `.env` locally:
`node --env-file=.env node_modules/.bin/tsx src/index.ts` — on Render you set
env vars in the dashboard, so nothing extra is needed there.)
