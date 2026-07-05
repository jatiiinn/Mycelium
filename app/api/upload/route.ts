import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, NODE_COLUMNS } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

// POST /api/upload — multipart form with fields: file (image), title (optional)
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${file.type || "unknown"}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 15 MB." }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim() || file.name || "Uploaded image";

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `uploads/${crypto.randomUUID()}.${ext || "jpg"}`;

  const sb = supabaseAdmin();
  const bytes = await file.arrayBuffer();

  const { error: upErr } = await sb.storage
    .from("mycelium")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: `storage: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = sb.storage.from("mycelium").getPublicUrl(path);

  const { data, error } = await sb
    .from("nodes")
    .insert({
      source_type: "image",
      title,
      thumbnail_url: pub.publicUrl,
      enrichment_status: "pending",
    })
    .select(NODE_COLUMNS)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ node: data });
}
