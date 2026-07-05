"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Masonry from "react-masonry-css";
import Header from "@/components/Header";
import NodeCard from "@/components/NodeCard";
import NodeModal from "@/components/NodeModal";
import AddModal from "@/components/AddModal";
import { PlusIcon } from "@/components/Icons";
import type { NodeItem, TagCount } from "@/lib/types";

const BREAKPOINTS = {
  default: 5, // wide desktop
  1536: 5,
  1280: 4,
  1024: 3,
  768: 3,
  640: 2, // mobile: 2 columns
};

export default function HomePage() {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Keep latest filters available to the poller without re-registering it.
  const filters = useRef({ query: "", tag: null as string | null });
  filters.current = { query, tag: activeTag };

  const fetchNodes = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.current.query) params.set("q", filters.current.query);
      if (filters.current.tag) params.set("tag", filters.current.tag);
      const res = await fetch(`/api/nodes?${params.toString()}`);
      if (res.status === 401) {
        window.location.href = "/unlock";
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      const json = await res.json();
      setNodes(json.nodes ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your saves.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) return;
      const json = await res.json();
      setTags(json.tags ?? []);
    } catch {
      /* tags dropdown just stays as-is */
    }
  }, []);

  // Initial load + reload when filters change
  useEffect(() => {
    fetchNodes();
  }, [query, activeTag, fetchNodes]);
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // While anything is pending/processing, quietly poll so shimmer cards
  // resolve into tags without a manual refresh.
  const anyBusy = nodes.some(
    (n) => n.enrichment_status === "pending" || n.enrichment_status === "processing"
  );
  useEffect(() => {
    if (!anyBusy) return;
    const t = setInterval(() => {
      fetchNodes({ silent: true });
      fetchTags();
    }, 20000);
    return () => clearInterval(t);
  }, [anyBusy, fetchNodes, fetchTags]);

  function refreshAll() {
    fetchNodes({ silent: true });
    fetchTags();
  }

  const emptyBecauseFiltered = !loading && nodes.length === 0 && (query || activeTag);
  const emptyLibrary = !loading && nodes.length === 0 && !query && !activeTag && !loadError;

  return (
    <div className="min-h-screen">
      <Header
        tags={tags}
        activeTag={activeTag}
        onSearch={setQuery}
        onTag={setActiveTag}
      />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {loading ? (
          <Masonry breakpointCols={BREAKPOINTS} className="masonry" columnClassName="masonry-col">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="shimmer mb-4 rounded-card"
                style={{ height: 140 + ((i * 53) % 160) }}
              />
            ))}
          </Masonry>
        ) : loadError ? (
          <div className="mx-auto mt-24 max-w-sm text-center">
            <p className="text-sm text-ember">{loadError}</p>
            <button
              onClick={() => fetchNodes()}
              className="mt-4 rounded-full border border-seam px-4 py-2 text-sm text-fog hover:border-lichen"
            >
              Try again
            </button>
          </div>
        ) : emptyLibrary ? (
          <div className="mx-auto mt-24 max-w-sm text-center">
            <span className="mx-auto mb-4 block h-2 w-2 rounded-full bg-lichen" aria-hidden />
            <h2 className="text-base font-medium">Nothing here yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-moss">
              Save something to Raindrop from Instagram, X, or Pinterest and it appears here
              within about 10 minutes — or add a link, image, or note now with the + button.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-5 rounded-full bg-lichen px-5 py-2 text-sm font-medium text-ink"
            >
              Add your first save
            </button>
          </div>
        ) : emptyBecauseFiltered ? (
          <div className="mx-auto mt-24 max-w-sm text-center">
            <h2 className="text-base font-medium">No matches</h2>
            <p className="mt-2 text-sm text-moss">
              Nothing matches {query ? <>“{query}”</> : null}
              {query && activeTag ? " with " : ""}
              {activeTag ? <>#{activeTag}</> : null}. Try a different search or clear the tag
              filter.
            </p>
          </div>
        ) : (
          <Masonry breakpointCols={BREAKPOINTS} className="masonry" columnClassName="masonry-col">
            {nodes.map((node) => (
              <NodeCard key={node.id} node={node} onOpen={setOpenNodeId} />
            ))}
          </Masonry>
        )}
      </main>

      {/* Persistent add button */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add a save"
        className="fixed bottom-6 right-6 z-40 rounded-full bg-lichen p-4 text-ink shadow-lg shadow-black/40 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-fog"
      >
        <PlusIcon />
      </button>

      {openNodeId && (
        <NodeModal
          nodeId={openNodeId}
          onClose={() => setOpenNodeId(null)}
          onChanged={refreshAll}
        />
      )}
      {addOpen && <AddModal onClose={() => setAddOpen(false)} onAdded={refreshAll} />}
    </div>
  );
}
