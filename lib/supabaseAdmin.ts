import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service role key.
// NEVER import this from a client component.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Columns returned to the UI (embedding and raw_payload are intentionally excluded).
export const NODE_COLUMNS =
  "id, raindrop_id, source_type, source_url, title, description, thumbnail_url, video_url, transcript, ai_summary, tags, tags_edited_by_user, enrichment_status, enrichment_error, created_at";
