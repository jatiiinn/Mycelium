import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/nodes?q=...&tag=...&limit=...&offset=...
// Uses the search_nodes RPC (full text search + tag filter + pagination).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const tag = sp.get("tag");
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "120", 10) || 120, 1), 300);
  const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("search_nodes", {
    query: q,
    tag_filter: tag || null,
    lim: limit,
    off: offset,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ nodes: data ?? [] });
}
