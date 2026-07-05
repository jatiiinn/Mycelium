"use client";

// Header matched to the reference: brand left, centered "Grid / Graph" nav
// (Graph is a disabled phase-2 placeholder), quiet utilities on the right.

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./Icons";
import type { TagCount } from "@/lib/types";

interface HeaderProps {
  tags: TagCount[];
  activeTag: string | null;
  onSearch: (q: string) => void;
  onTag: (tag: string | null) => void;
}

export default function Header({ tags, activeTag, onSearch, onTag }: HeaderProps) {
  const [q, setQ] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Debounced search
  function handleQuery(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => onSearch(value), 300);
  }

  // Close the tag panel on outside click / Escape
  useEffect(() => {
    if (!tagsOpen) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setTagsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTagsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [tagsOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="relative mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-xs sm:px-10">
        {/* Wordmark */}
        <a href="/" className="tracking-wide text-ink">
          Mycelium
        </a>

        {/* Centered view switch — Graph is a phase-2 placeholder */}
        <nav
          aria-label="View"
          className="order-2 flex items-center gap-1.5 sm:absolute sm:left-1/2 sm:order-none sm:-translate-x-1/2"
        >
          <span className="text-ink">Grid</span>
          <span className="text-dim/60" aria-hidden>/</span>
          <span className="group relative">
            <button disabled aria-disabled="true" className="cursor-not-allowed text-dim/50">
              Graph
            </button>
            <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap border border-line bg-paper px-2 py-1 text-[10px] text-dim group-hover:block">
              Coming soon
            </span>
          </span>
        </nav>

        {/* Right utilities */}
        <div className="order-1 ml-auto flex items-center gap-4 sm:order-none">
          {/* Tag filter */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setTagsOpen((v) => !v)}
              aria-expanded={tagsOpen}
              className={
                activeTag
                  ? "text-ink underline underline-offset-4"
                  : "text-dim transition-colors hover:text-ink"
              }
            >
              {activeTag ? `Tags: ${activeTag}` : "Tags"}
            </button>
            {tagsOpen && (
              <div className="absolute right-0 top-full z-40 mt-2.5 max-h-80 w-72 overflow-y-auto border border-line bg-paper p-3 shadow-lg shadow-black/5">
                {tags.length === 0 ? (
                  <p className="px-1 py-2 text-dim">
                    No tags yet — they appear here once enrichment runs.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeTag && (
                      <button
                        onClick={() => {
                          onTag(null);
                          setTagsOpen(false);
                        }}
                        className="border border-line px-2.5 py-1 text-[11px] text-dim hover:text-ink"
                      >
                        Clear filter
                      </button>
                    )}
                    {tags.map((t) => (
                      <button
                        key={t.tag}
                        onClick={() => {
                          onTag(t.tag === activeTag ? null : t.tag);
                          setTagsOpen(false);
                        }}
                        className={`border px-2.5 py-1 text-[11px] transition-colors ${
                          t.tag === activeTag
                            ? "border-ink bg-ink text-paper"
                            : "border-line text-ink hover:border-ink"
                        }`}
                      >
                        {t.tag}
                        <span className={`ml-1 ${t.tag === activeTag ? "text-paper/60" : "text-dim"}`}>
                          {t.cnt}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search — quiet underline field, full width on mobile */}
        <div className="relative order-3 w-full sm:order-none sm:ml-0 sm:w-44 sm:focus-within:w-64 sm:transition-all">
          <input
            value={q}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search saves"
            className="w-full border-b border-line bg-transparent pb-1 pr-6 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-ink"
          />
          {q && (
            <button
              onClick={() => handleQuery("")}
              aria-label="Clear search"
              className="absolute right-0 top-0 p-0.5 text-dim hover:text-ink"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
