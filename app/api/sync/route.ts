import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { inferSourceType } from "@/lib/sourceType";

// Pull new saves from Raindrop into the nodes table.
// Triggered by: Vercel Cron (Authorization: Bearer CRON_SECRET),
// the Render worker's periodic ping, or manually with ?secret=CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RaindropItem {
  _id: number;
  link: string;
  title?: string;
  excerpt?: string;
  note?: string;
  cover?: string;
  created: string;
  [key: string]: unknown;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const qp = req.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || qp === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.RAINDROP_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "RAINDROP_TOKEN is not set" }, { status: 500 });
  }

  const sb = supabaseAdmin();

  const { data: state, error: stateErr } = await sb
    .from("sync_state")
    .select("last_synced_at")
    .eq("id", 1)
    .single();
  if (stateErr) {
    return NextResponse.json({ error: `sync_state: ${stateErr.message}` }, { status: 500 });
  }
  const lastSynced = new Date(state.last_synced_at).getTime();

  // Collection 0 = "All bookmarks". Newest first; stop paging once we reach
  // items older than the last synced timestamp.
  const fresh: RaindropItem[] = [];
  const MAX_PAGES = 4; // 4 x 50 = up to 200 new items per run
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `https://api.raindrop.io/rest/v1/raindrops/0?sort=-created&perpage=50&page=${page}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `Raindrop API ${resp.status}: ${text.slice(0, 300)}` },
        { status: 502 }
      );
    }
    const json = (await resp.json()) as { items?: RaindropItem[] };
    const items = json.items ?? [];
    if (items.length === 0) break;

    let reachedOld = false;
    for (const item of items) {
      if (new Date(item.created).getTime() > lastSynced) {
        fresh.push(item);
      } else {
        reachedOld = true;
      }
    }
    if (reachedOld || items.length < 50) break;
  }

  if (fresh.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  const rows = fresh.map((item) => ({
    raindrop_id: item._id,
    source_type: inferSourceType(item.link),
    source_url: item.link,
    title: item.title?.trim() || item.link,
    description: item.excerpt?.trim() || item.note?.trim() || null,
    thumbnail_url: item.cover || null,
    enrichment_status: "pending",
    raw_payload: item,
    created_at: item.created,
  }));

  // Upsert on raindrop_id so re-runs never duplicate.
  const { error: insertErr } = await sb
    .from("nodes")
    .upsert(rows, { onConflict: "raindrop_id", ignoreDuplicates: true });
  if (insertErr) {
    return NextResponse.json({ error: `insert: ${insertErr.message}` }, { status: 500 });
  }

  const newest = fresh
    .map((i) => new Date(i.created).getTime())
    .reduce((a, b) => Math.max(a, b), lastSynced);
  await sb
    .from("sync_state")
    .update({ last_synced_at: new Date(newest).toISOString(), updated_at: new Date().toISOString() })
    .eq("id", 1);

  return NextResponse.json({ synced: rows.length });
}
