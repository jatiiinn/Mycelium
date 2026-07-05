import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface NodeRow {
  id: string;
  raindrop_id: number | null;
  source_type: string;
  source_url: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  transcript: string | null;
  ai_summary: string | null;
  tags: string[];
  tags_edited_by_user: boolean;
  enrichment_status: string;
  enrichment_error: string | null;
  enrichment_attempts: number;
  processing_started_at: string | null;
  created_at: string;
}

let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

const COLS =
  "id, raindrop_id, source_type, source_url, title, description, thumbnail_url, video_url, transcript, ai_summary, tags, tags_edited_by_user, enrichment_status, enrichment_error, enrichment_attempts, processing_started_at, created_at";

// Re-queue jobs stuck in 'processing' for over 10 minutes (crash, restart, etc.)
export async function resetStuck(): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await sb()
    .from("nodes")
    .update({ enrichment_status: "pending" })
    .eq("enrichment_status", "processing")
    .lt("processing_started_at", cutoff);
}

export async function fetchPending(limit: number): Promise<NodeRow[]> {
  const { data, error } = await sb()
    .from("nodes")
    .select(COLS)
    .eq("enrichment_status", "pending")
    .lt("enrichment_attempts", 3)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`fetchPending: ${error.message}`);
  return (data ?? []) as NodeRow[];
}

// Atomically-ish claim a node (only succeeds if it is still 'pending').
export async function claim(node: NodeRow): Promise<NodeRow | null> {
  const { data, error } = await sb()
    .from("nodes")
    .update({
      enrichment_status: "processing",
      processing_started_at: new Date().toISOString(),
      enrichment_attempts: node.enrichment_attempts + 1,
    })
    .eq("id", node.id)
    .eq("enrichment_status", "pending")
    .select(COLS);
  if (error) throw new Error(`claim: ${error.message}`);
  return data && data.length > 0 ? (data[0] as NodeRow) : null;
}

export async function updateNode(
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await sb().from("nodes").update(patch).eq("id", id);
  if (error) throw new Error(`updateNode: ${error.message}`);
}

export async function uploadVideo(
  nodeId: string,
  bytes: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  const path = `videos/${nodeId}.${ext}`;
  const { error } = await sb()
    .storage.from("mycelium")
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`storage upload: ${error.message}`);
  const { data } = sb().storage.from("mycelium").getPublicUrl(path);
  return data.publicUrl;
}
