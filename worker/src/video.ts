// Video pipeline: yt-dlp download -> ffmpeg audio extract -> Groq Whisper.
// Also uploads the video to Supabase Storage (size-capped) so the detail
// view can play it inline, and stores that URL in video_url.
//
// Failures here are expected sometimes (private posts, deleted reels,
// rate limiting) — callers treat the result as best-effort and continue
// enrichment without a transcript.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribe } from "./groq.js";
import { uploadVideo } from "./supabase.js";
import { log, logError } from "./log.js";

const run = promisify(execFile);

export interface VideoResult {
  transcript: string | null;
  videoPublicUrl: string | null;
  failureReason: string | null;
}

function extraArgs(): string[] {
  const raw = process.env.YTDLP_EXTRA_ARGS?.trim();
  return raw ? raw.split(/\s+/) : [];
}

export async function processVideo(nodeId: string, url: string): Promise<VideoResult> {
  const result: VideoResult = { transcript: null, videoPublicUrl: null, failureReason: null };
  const dir = await mkdtemp(join(tmpdir(), "mycelium-"));
  try {
    // 1. Download the video
    try {
      await run(
        "yt-dlp",
        [
          "--no-playlist",
          "--no-warnings",
          "-f", "mp4/bestvideo*+bestaudio/best",
          "--max-filesize", "300m",
          "-o", join(dir, "video.%(ext)s"),
          ...extraArgs(),
          url,
        ],
        { timeout: 4 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }
      );
    } catch (e) {
      result.failureReason = `yt-dlp: ${e instanceof Error ? e.message.slice(0, 200) : "download failed"}`;
      logError(`video download failed for ${url}`, e);
      return result; // graceful: no transcript, enrichment continues
    }

    const files = await readdir(dir);
    const videoFile = files.find((f) => f.startsWith("video."));
    if (!videoFile) {
      result.failureReason = "yt-dlp produced no output file";
      return result;
    }
    const videoPath = join(dir, videoFile);

    // 2. Extract mono 16 kHz audio with ffmpeg (small enough for Groq limits)
    const audioPath = join(dir, "audio.m4a");
    try {
      await run(
        "ffmpeg",
        ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", audioPath],
        { timeout: 3 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }
      );
    } catch (e) {
      result.failureReason = "ffmpeg audio extraction failed";
      logError(`ffmpeg failed for ${url}`, e);
    }

    // 3. Transcribe (only if audio extraction worked)
    if (!result.failureReason) {
      try {
        const text = await transcribe(audioPath);
        result.transcript = text || null;
      } catch (e) {
        result.failureReason = `transcription: ${e instanceof Error ? e.message.slice(0, 200) : "failed"}`;
        logError(`transcription failed for ${url}`, e);
      }
    }

    // 4. Upload the playable video to Supabase Storage (best-effort, capped)
    try {
      const maxMb = Number(process.env.MAX_VIDEO_MB || 60);
      const info = await stat(videoPath);
      const ext = videoFile.split(".").pop() || "mp4";
      if (ext === "mp4" && info.size <= maxMb * 1024 * 1024) {
        const bytes = await readFile(videoPath);
        result.videoPublicUrl = await uploadVideo(nodeId, bytes, "video/mp4", "mp4");
        log(`uploaded video for node ${nodeId} (${Math.round(info.size / 1024 / 1024)} MB)`);
      }
    } catch (e) {
      logError(`video upload skipped for node ${nodeId}`, e); // non-fatal
    }

    return result;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
