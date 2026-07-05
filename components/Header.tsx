"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon, CloseIcon } from "./Icons";
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
    <header className="sticky top-0 z-30 border-b border-seam bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        {/* Wordmark */}
        <a href="/" className="flex items-center gap-2 text-base tracking-wide">
          <span className="h-1.5 w-1.5 rounded-full bg-lichen" aria-hidden />
          mycelium
        </a>

        {/* Search */}
        <div className="relative order-3 w-full sm:order-2 sm:w-auto sm:flex-1 sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-moss" />
          <input
            value={q}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder="Search titles, captions, transcripts, tags…"
            aria-label="Search saves"
            className="w-full rounded-full border border-seam bg-surface py-2 pl-9 pr-9 text-sm text-fog placeholder:text-moss outline-none focus:border-lichen"
          />
          {q && (
            <button
              onClick={() => handleQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-moss hover:text-fog"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
          {/* Tag filter */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setTagsOpen((v) => !v)}
              aria-expanded={tagsOpen}
              className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                activeTag
                  ? "border-lichen bg-lichen/10 text-lichen"
                  : "border-seam bg-surface text-moss hover:text-fog"
              }`}
            >
              {activeTag ? `#${activeTag}` : "Tags"}
            </button>
            {tagsOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 max-h-80 w-72 overflow-y-auto rounded-card border border-seam bg-surface p-3 shadow-xl shadow-black/50">
                {tags.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-moss">
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
                        className="rounded-full border border-seam px-2.5 py-1 text-xs text-moss hover:text-fog"
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
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                          t.tag === activeTag
                            ? "bg-lichen text-ink"
                            : "bg-raised text-fog hover:bg-seam"
                        }`}
                      >
                        {t.tag}
                        <span className="ml-1 text-moss">{t.cnt}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grid / Graph toggle — Graph is a phase-2 placeholder */}
          <div className="group relative flex items-center overflow-hidden rounded-full border border-seam bg-surface text-sm">
            <span className="px-3.5 py-2 bg-raised text-fog">Grid</span>
            <button
              disabled
              aria-disabled="true"
              className="cursor-not-allowed px-3.5 py-2 text-moss/50"
            >
              Graph
            </button>
            <span className="pointer-events-none absolute right-0 top-full z-40 mt-1 hidden translate-y-1 whitespace-nowrap rounded-md border border-seam bg-raised px-2 py-1 text-xs text-moss group-hover:block">
              Coming soon
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
