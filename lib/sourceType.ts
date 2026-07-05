import type { SourceType } from "./types";

// Infer a node's source_type from its URL. Used by both the Raindrop sync
// and the manual "paste a link" flow so classification stays consistent.
export function inferSourceType(rawUrl: string | null | undefined): SourceType {
  if (!rawUrl) return "link";
  let host = "";
  let path = "";
  try {
    const u = new URL(rawUrl);
    host = u.hostname.toLowerCase().replace(/^www\./, "");
    path = u.pathname.toLowerCase();
  } catch {
    return "link";
  }
  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    if (path.startsWith("/reel/") || path.startsWith("/reels/")) return "instagram_reel";
    if (path.startsWith("/p/")) return "instagram_post";
    return "instagram_post";
  }
  if (host === "x.com" || host === "twitter.com" || host.endsWith(".twitter.com")) {
    return "x_post";
  }
  if (host === "pin.it" || host === "pinterest.com" || host.includes("pinterest.")) {
    return "pinterest";
  }
  return "link";
}
