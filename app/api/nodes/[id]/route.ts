import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, NODE_COLUMNS } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/nodes/:id -> { node, related }
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sb = supabaseAdmin();

  const { data: node, error } = await sb
    .from("nodes")
    .select(NODE_COLUMNS)
    .eq("id", params.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Couldn't load this save." }, { status: 500 });
  }
  if (!node) {
    return NextResponse.json({ error: "This save no longer exists." }, { status: 404 });
  }

  const { data: related } = await sb.rpc("related_nodes", {
    node_id: params.id,
    match_count: 6,
  });

  return NextResponse.json({ node, related: related ?? [] });
}

// PATCH /api/nodes/:id
// body: { tags?: string[], retry?: boolean }
// - tags: replaces tags and locks them (tags_edited_by_user = true)
// - retry: re-queues a failed node for enrichment
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { tags?: unknown; retry?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (Array.isArray(body.tags)) {
    const clean = body.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
      .filter((t) => t.length > 0 && t.length <= 40)
      .slice(0, 20);
    update.tags = Array.from(new Set(clean));
    update.tags_edited_by_user = true;
  }

  if (body.retry === true) {
    update.enrichment_status = "pending";
    update.enrichment_error = null;
    update.enrichment_attempts = 0;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("nodes")
    .update(update)
    .eq("id", params.id)
    .select(NODE_COLUMNS)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ node: data });
}

// DELETE /api/nodes/:id — remove a save (storage files, if any, are left in
// the bucket; they can be cleaned up from the Supabase dashboard).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sb = supabaseAdmin();
  const { error } = await sb.from("nodes").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
