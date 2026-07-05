"use client";

// Detail view. A modal (rather than a /node/[id] page) keeps the grid,
// its scroll position, and any active search/filter intact while browsing.

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={node?.title || "Save details"}
    >
      <div className="relative my-auto w-full max-w-2xl border border-line bg-paper">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 border border-line bg-paper/90 p-2 text-ink backdrop-blur-sm transition-colors hover:bg-ink hover:text-paper"
        >
          <CloseIcon />
        </button>

        {loading ? (
          <div className="space-y-3 p-6">
            <div className="shimmer h-64 w-full" />
            <div className="shimmer h-4 w-2/3" />
            <div className="shimmer h-3 w-1/2" />
          </div>
        ) : error || !node ? (
          <div className="p-10 text-center">
            <p className="text-xs text-ember">{error ?? "This save couldn't be loaded."}</p>
            <button
              onClick={() => load(nodeId)}
              className="mt-5 border border-ink px-4 py-2 text-xs text-ink transition-colors hover:bg-ink hover:text-paper"
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
                className="max-h-[65vh] w-full border-b border-line bg-faint object-contain"
              />
            ) : node.thumbnail_url && !imgBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={node.thumbnail_url}
                alt={node.title || "Saved item"}
                onError={() => setImgBroken(true)}
                className="max-h-[65vh] w-full border-b border-line bg-faint object-contain"
              />
            ) : null}

            <div className="space-y-6 p-5 sm:p-7">
              {/* Title + source */}
              <div className="flex items-start gap-3 pr-8">
                <SourceBadge type={node.source_type} />
                <div className="min-w-0">
                  <h2 className="text-sm font-medium leading-snug text-ink">
                    {node.title || "Untitled"}
                  </h2>
                  <p className="mt-1 text-[11px] text-dim">
                    Saved {new Date(node.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Failed state */}
              {node.enrichment_status === "failed" && (
                <div className="border border-ember/40 p-3 text-xs">
                  <p className="text-ember">
                    Automatic organizing failed for this save
                    {node.enrichment_error ? ` (${node.enrichment_error.slice(0, 160)})` : ""}.
                  </p>
                  <button
                    onClick={retry}
                    className="mt-2 bg-ember px-3 py-1.5 text-[11px] font-medium text-paper"
                  >
                    Retry enrichment
                  </button>
                </div>
              )}
              {(node.enrichment_status === "pending" ||
                node.enrichment_status === "processing") && (
                <p className="border border-line bg-faint p-3 text-xs text-dim">
                  Still organizing this save — tags, summary and transcript appear here when
                  it finishes (usually within a couple of minutes).
                </p>
              )}

              {/* AI summary */}
              {node.ai_summary && (
                <div>
                  <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-dim">
                    Why keep this
                  </h3>
                  <p className="text-xs leading-relaxed text-ink">{node.ai_summary}</p>
                </div>
              )}

              {/* Original description / caption */}
              {node.description && (
                <div>
                  <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-dim">
                    Original caption
                  </h3>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-dim">
                    {node.description}
                  </p>
                </div>
              )}

              {/* Transcript */}
              {transcript && (
                <div>
                  <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-dim">
                    Transcript
                  </h3>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-dim">
                    {transcriptOpen || !longTranscript
                      ? transcript
                      : transcript.slice(0, TRANSCRIPT_PREVIEW) + "…"}
                  </p>
                  {longTranscript && (
                    <button
                      onClick={() => setTranscriptOpen((v) => !v)}
                      className="mt-2 text-[11px] text-ink underline underline-offset-4"
                    >
                      {transcriptOpen ? "Show less" : "Show full transcript"}
                    </button>
                  )}
                </div>
              )}

              {/* Tags */}
              <div>
                <h3 className="mb-2 text-[10px] uppercase tracking-[0.14em] text-dim">Tags</h3>
                <TagEditor key={node.tags.join("|")} tags={node.tags} onSave={saveTags} />
              </div>

              {/* Source link + delete */}
              <div className="flex items-center justify-between border-t border-line pt-4">
                {node.source_url ? (
                  <a
                    href={node.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-ink underline underline-offset-4"
                  >
                    Open original <ExternalIcon />
                  </a>
                ) : (
                  <span className="text-xs text-dim">Added directly</span>
                )}
                {confirmDelete ? (
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="text-dim">Delete this save?</span>
                    <button onClick={remove} className="bg-ember px-3 py-1 font-medium text-paper">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="text-dim hover:text-ink">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-[11px] text-dim transition-colors hover:text-ember"
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Related saves */}
              {related.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[10px] uppercase tracking-[0.14em] text-dim">
                    Related saves
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => load(r.id)}
                        className="group border border-line text-left transition-colors hover:border-ink"
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
                        <p className="truncate px-2 py-1.5 text-[10px] text-dim group-hover:text-ink">
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
