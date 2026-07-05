import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, NODE_COLUMNS } from "@/lib/supabaseAdmin";
import { inferSourceType } from "@/lib/sourceType";

export const dynamic = "force-dynamic";

// POST /api/add
// body: { kind: "link", url, title? } | { kind: "note", text, title? }
export async function POST(req: NextRequest) {
  let body: { kind?: string; url?: string; text?: string; title?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  if (body.kind === "link") {
    const url = (body.url ?? "").trim();
    try {
      // Validate it parses as a URL.
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
    } catch {
      return NextResponse.json(
        { error: "That doesn't look like a valid http(s) link." },
        { status: 400 }
      );
    }
    const { data, error } = await sb
      .from("nodes")
      .insert({
        source_type: inferSourceType(url),
        source_url: url,
        title: body.title?.trim() || url,
        enrichment_status: "pending",
      })
      .select(NODE_COLUMNS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ node: data });
  }

  if (body.kind === "note") {
    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "The note is empty." }, { status: 400 });
    }
    const title =
      body.title?.trim() || text.slice(0, 64) + (text.length > 64 ? "…" : "");
    const { data, error } = await sb
      .from("nodes")
      .insert({
        source_type: "manual_note",
        title,
        description: text,
        enrichment_status: "pending",
      })
      .select(NODE_COLUMNS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ node: data });
  }

  return NextResponse.json({ error: "kind must be 'link' or 'note'" }, { status: 400 });
}
