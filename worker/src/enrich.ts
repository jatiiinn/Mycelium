// Enrichment of a single node: OG metadata -> (optional) video/transcript ->
// Gemini tags + summary -> Gemini embedding -> mark done.

import type { NodeRow } from "./supabase.js";
import { updateNode } from "./supabase.js";
import { fetchOg } from "./og.js";
import { processVideo } from "./video.js";
import { tagAndSummarize, tagAndSummarizeImage } from "./gemini.js";
import { embed } from "./gemini.js";
import { log, logError, errMessage } from "./log.js";

const MAX_ATTEMPTS = 3;

export async function processNode(node: NodeRow): Promise<void> {
  log(`processing node ${node.id} (${node.source_type}) attempt ${node.enrichment_attempts}`);
  const patch: Record<string, unknown> = {};

  try {
    let title = node.title;
    let description = node.description;
    let thumbnail = node.thumbnail_url;

    // 1. Open Graph fallback/supplement for links with missing metadata.
    if (
      node.source_url &&
      node.source_type !== "image" &&
      node.source_type !== "manual_note" &&
      (!title || title === node.source_url || !description || !thumbnail)
    ) {
      const og = await fetchOg(node.source_url);
      if ((!title || title === node.source_url) && og.title) {
        title = og.title;
        patch.title = title;
      }
      if (!description && og.description) {
        description = og.description;
        patch.description = description;
      }
      if (!thumbnail && og.image) {
        thumbnail = og.image;
        patch.thumbnail_url = thumbnail;
      }
    }

    // 2. Video download + transcription for reels / anything with a video URL.
    let transcript = node.transcript;
    const isVideo = node.source_type === "instagram_reel" || !!node.video_url;
    if (isVideo && node.source_url && !transcript) {
      const v = await processVideo(node.id, node.source_url);
      if (v.transcript) {
        transcript = v.transcript;
        patch.transcript = transcript;
      }
      if (v.videoPublicUrl) patch.video_url = v.videoPublicUrl;
      if (v.failureReason) {
        // Logged, but we continue with whatever text we have (per design).
        log(`node ${node.id}: video step degraded — ${v.failureReason}`);
      }
    }

    // 3. Tags + summary via Gemini (vision for images, text otherwise).
    const contextText = [
      title && title !== node.source_url ? `Title: ${title}` : "",
      description ? `Caption/description: ${description}` : "",
      transcript ? `Transcript: ${transcript}` : "",
      node.source_url ? `Source URL: ${node.source_url}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    let tags: string[] = [];
    let summary = "";
    if (node.source_type === "image" && thumbnail) {
      const r = await tagAndSummarizeImage(thumbnail, contextText);
      tags = r.tags;
      summary = r.summary;
    } else {
      const r = await tagAndSummarize(contextText || `A saved link: ${node.source_url}`);
      tags = r.tags;
      summary = r.summary;
    }

    if (summary) patch.ai_summary = summary;
    // Never overwrite tags the user has edited by hand.
    if (!node.tags_edited_by_user && tags.length > 0) {
      patch.tags = tags;
    }

    // 4. Embedding over the combined text.
    const embedText = [title, description, transcript, summary]
      .filter(Boolean)
      .join("\n\n");
    if (embedText.trim()) {
      patch.embedding = await embed(embedText);
    }

    patch.enrichment_status = "done";
    patch.enrichment_error = null;
    await updateNode(node.id, patch);
    log(`node ${node.id} done (${tags.length} tags${transcript ? ", transcript" : ""})`);
  } catch (err) {
    logError(`node ${node.id} enrichment failed`, err);
    const exhausted = node.enrichment_attempts >= MAX_ATTEMPTS;
    try {
      await updateNode(node.id, {
        ...patch, // keep any partial progress (OG data, transcript, video URL)
        enrichment_status: exhausted ? "failed" : "pending",
        enrichment_error: errMessage(err).slice(0, 500),
      });
    } catch (e2) {
      logError(`node ${node.id} could not record failure`, e2);
    }
  }
}
