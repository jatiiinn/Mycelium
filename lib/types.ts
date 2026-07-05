export type SourceType =
  | "instagram_post"
  | "instagram_reel"
  | "x_post"
  | "pinterest"
  | "link"
  | "image"
  | "manual_note";

export type EnrichmentStatus = "pending" | "processing" | "done" | "failed";

export interface NodeItem {
  id: string;
  source_type: SourceType;
  source_url: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  transcript?: string | null;
  ai_summary: string | null;
  tags: string[];
  tags_edited_by_user: boolean;
  enrichment_status: EnrichmentStatus;
  enrichment_error?: string | null;
  created_at: string;
}

export interface RelatedNode {
  id: string;
  source_type: SourceType;
  title: string;
  thumbnail_url: string | null;
  tags: string[];
  enrichment_status: EnrichmentStatus;
  distance: number;
}

export interface TagCount {
  tag: string;
  cnt: number;
}
