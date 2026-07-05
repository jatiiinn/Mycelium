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
  default: 5, // wide desktop, like the reference
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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

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

  // While anything is pending/processing, quietly poll so shimmer captions
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

  function handleDeleted(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id)); // gone instantly
    showToast("Deleted");
  }

  function handleMissing(id: string) {
    setOpenNodeId(null);
    setNodes((prev) => prev.filter((n) => n.id !== id));
    showToast("That save no longer exists");
    fetchTags();
  }

  function handleAdded(label: string) {
    showToast(label);
    refreshAll();
  }

  const emptyBecauseFiltered = !loading && nodes.length === 0 && (query || activeTag);
  const emptyLibrary = !loading && nodes.length === 0 && !query && !activeTag && !loadError;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        tags={tags}
        activeTag={activeTag}
        onSearch={setQuery}
        onTag={setActiveTag}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-16 pt-10 sm:px-10 sm:pt-14">
        {loading ? (
          <Masonry breakpointCols={BREAKPOINTS} className="masonry" columnClassName="masonry-col">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="mb-10">
                <div className="shimmer w-full" style={{ height: 140 + ((i * 53) % 160) }} />
                <div className="shimmer mt-2 h-3 w-10" />
              </div>
            ))}
          </Masonry>
        ) : loadError ? (
          <div className="mx-auto mt-28 max-w-sm text-center">
            <p className="text-xs text-ember">{loadError}</p>
            <button
              onClick={() => fetchNodes()}
              className="mt-5 border border-ink px-4 py-2 text-xs text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              Try again
            </button>
          </div>
        ) : emptyLibrary ? (
          <div className="mx-auto mt-28 max-w-sm text-center">
            <h2 className="text-sm text-ink">Nothing here yet</h2>
            <p className="mt-2 text-xs leading-relaxed text-dim">
              Save something to Raindrop from Instagram, X, or Pinterest and it appears here
              within about 10 minutes — or add a link, image, or note now with the + button.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-6 bg-ink px-5 py-2 text-xs text-paper"
            >
              Add your first save
            </button>
          </div>
        ) : emptyBecauseFiltered ? (
          <div className="mx-auto mt-28 max-w-sm text-center">
            <h2 className="text-sm text-ink">No matches</h2>
            <p className="mt-2 text-xs leading-relaxed text-dim">
              Nothing matches {query ? <>“{query}”</> : null}
              {query && activeTag ? " with " : ""}
              {activeTag ? <>tag “{activeTag}”</> : null}. Try a different search or clear the
              tag filter.
            </p>
          </div>
        ) : (
          <Masonry breakpointCols={BREAKPOINTS} className="masonry" columnClassName="masonry-col">
            {nodes.map((node, i) => (
              <NodeCard key={node.id} node={node} index={i} onOpen={setOpenNodeId} />
            ))}
          </Masonry>
        )}
      </main>

      {/* Quiet footer strip, like the reference */}
      <footer className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 pb-5 text-[10px] text-dim sm:px-10">
        <span>Personal archive</span>
        <span>{loading ? "" : `${nodes.length} ${nodes.length === 1 ? "save" : "saves"}`}</span>
      </footer>

      {/* Persistent add button */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add a save"
        className="fixed bottom-6 right-6 z-40 rounded-full bg-ink p-4 text-paper shadow-lg shadow-black/15 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        <PlusIcon />
      </button>

      {openNodeId && (
        <NodeModal
          nodeId={openNodeId}
          onClose={() => setOpenNodeId(null)}
          onChanged={refreshAll}
          onDeleted={handleDeleted}
          onMissing={handleMissing}
          onToast={showToast}
        />
      )}
      {addOpen && <AddModal onClose={() => setAddOpen(false)} onAdded={handleAdded} />}

      {/* Toast — quiet black pill, auto-dismisses */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="toast-in fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 bg-ink px-4 py-2.5 text-xs text-paper shadow-lg shadow-black/20"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
