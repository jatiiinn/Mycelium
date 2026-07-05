"use client";

// Detail view. A modal (rather than a /node/[id] page) keeps the masonry grid,
// its scroll position, and any active search/filter intact while browsing —
// which fits how a visual dump is actually skimmed.

import { useCallback, useEffect, useState } from "react";
import type { NodeItem, RelatedNode } from "@/lib/types";
import { SourceBadge, CloseIcon, ExternalIcon } from "./Icons";
import TagEditor from "./TagEditor";

interface NodeModalProps {
  nodeId: string;
  onClose: () => void;
  onChanged: () => void; // tell the grid to refetch (tags edited, retried, deleted)
}

const TRANSCRIPT_PREVIEW = 320;

export default function NodeModal({ nodeId, onClose, onChanged }: NodeModalProps) {
  const [node, setNode] = useState<NodeItem | null>(null);
  const [related, setRelated] = useState<RelatedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setImgBroken(false);
    setTranscriptOpen(false);
    setConfirmDelete(false);
    try {
      const res = await fetch(`/api/nodes/${id}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
      const json = await res.json();
      setNode(json.node);
      setRelated(json.related ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load this save.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(nodeId);
  }, [nodeId, load]);

  // Escape closes; lock body scroll while open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function saveTags(tags: string[]) {
    const res = await fetch(`/api/nodes/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't save tags.");
    const json = await res.json();
    setNode(json.node);
    onChanged();
  }

  async function retry() {
    await fetch(`/api/nodes/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retry: true }),
    });
    onChanged();
    load(nodeId);
  }

  async function remove() {
    await fetch(`/api/nodes/${nodeId}`, { method: "DELETE" });
    onChanged();
    onClose();
  }

  const transcript = node?.transcript ?? "";
  const longTranscript = transcript.length > TRANSCRIPT_PREVIEW;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={node?.title || "Save details"}
    >
      <div className="relative my-auto w-full max-w-2xl rounded-card border border-seam bg-surface">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-ink/70 p-2 text-fog backdrop-blur-sm hover:text-lichen"
        >
          <CloseIcon />
        </button>

        {loading ? (
          <div className="space-y-3 p-6">
            <div className="shimmer h-64 w-full rounded-card" />
            <div className="shimmer h-5 w-2/3 rounded-full" />
            <div className="shimmer h-4 w-1/2 rounded-full" />
          </div>
        ) : error || !node ? (
          <div className="p-8 text-center">
            <p className="text-sm text-ember">{error ?? "This save couldn't be loaded."}</p>
            <button
              onClick={() => load(nodeId)}
              className="mt-4 rounded-full border border-seam px-4 py-2 text-sm text-fog hover:border-lichen"
            >
              Try again
            </button>
          </div>
        ) : (
          <div>
            {/* Media */}
            {node.video_url ? (
              <video
                src={node.video_url}
                controls
                playsInline
                poster={node.thumbnail_url ?? undefined}
                className="max-h-[65vh] w-full rounded-t-card bg-black object-contain"
              />
            ) : node.thumbnail_url && !imgBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={node.thumbnail_url}
                alt={node.title || "Saved item"}
                onError={() => setImgBroken(true)}
                className="max-h-[65vh] w-full rounded-t-card bg-black object-contain"
              />
            ) : null}

            <div className="space-y-5 p-5 sm:p-6">
              {/* Title + source */}
              <div className="flex items-start gap-3 pr-8">
                <SourceBadge type={node.source_type} />
                <div className="min-w-0">
                  <h2 className="text-base font-medium leading-snug text-fog">
                    {node.title || "Untitled"}
                  </h2>
                  <p className="mt-0.5 text-xs text-moss">
                    Saved {new Date(node.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Failed state */}
              {node.enrichment_status === "failed" && (
                <div className="rounded-card border border-ember/30 bg-ember/10 p-3 text-sm">
                  <p className="text-ember">
                    Automatic organizing failed for this save
                    {node.enrichment_error ? ` (${node.enrichment_error.slice(0, 160)})` : ""}.
                  </p>
                  <button
                    onClick={retry}
                    className="mt-2 rounded-full bg-ember px-3 py-1 text-xs font-medium text-ink"
                  >
                    Retry enrichment
                  </button>
                </div>
              )}
              {(node.enrichment_status === "pending" ||
                node.enrichment_status === "processing") && (
                <p className="rounded-card bg-raised p-3 text-sm text-moss">
                  Still organizing this save — tags, summary and transcript appear here when
                  it finishes (usually within a couple of minutes).
                </p>
              )}

              {/* AI summary */}
              {node.ai_summary && (
                <div>
                  <h3 className="mb-1 text-xs uppercase tracking-wider text-moss">Why keep this</h3>
                  <p className="text-sm leading-relaxed text-fog">{node.ai_summary}</p>
                </div>
              )}

              {/* Original description / caption */}
              {node.description && (
                <div>
                  <h3 className="mb-1 text-xs uppercase tracking-wider text-moss">Original caption</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-moss">
                    {node.description}
                  </p>
                </div>
              )}

              {/* Transcript */}
              {transcript && (
                <div>
                  <h3 className="mb-1 text-xs uppercase tracking-wider text-moss">Transcript</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-moss">
                    {transcriptOpen || !longTranscript
                      ? transcript
                      : transcript.slice(0, TRANSCRIPT_PREVIEW) + "…"}
                  </p>
                  {longTranscript && (
                    <button
                      onClick={() => setTranscriptOpen((v) => !v)}
                      className="mt-1.5 text-xs text-lichen hover:underline"
                    >
                      {transcriptOpen ? "Show less" : "Show full transcript"}
                    </button>
                  )}
                </div>
              )}

              {/* Tags */}
              <div>
                <h3 className="mb-2 text-xs uppercase tracking-wider text-moss">Tags</h3>
                <TagEditor key={node.tags.join("|")} tags={node.tags} onSave={saveTags} />
              </div>

              {/* Source link + delete */}
              <div className="flex items-center justify-between border-t border-seam pt-4">
                {node.source_url ? (
                  <a
                    href={node.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-lichen hover:underline"
                  >
                    Open original <ExternalIcon />
                  </a>
                ) : (
                  <span className="text-sm text-moss">Added directly</span>
                )}
                {confirmDelete ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-moss">Delete this save?</span>
                    <button onClick={remove} className="rounded-full bg-ember px-3 py-1 font-medium text-ink">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="text-moss hover:text-fog">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-moss hover:text-ember"
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Related saves */}
              {related.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs uppercase tracking-wider text-moss">Related saves</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => load(r.id)}
                        className="group overflow-hidden rounded-card border border-seam bg-raised text-left hover:border-moss/60"
                      >
                        {r.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.thumbnail_url}
                            alt={r.title || "Related save"}
                            loading="lazy"
                            className="h-20 w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : null}
                        <p className="truncate px-2 py-1.5 text-[11px] text-moss group-hover:text-fog">
                          {r.title || "Untitled"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
