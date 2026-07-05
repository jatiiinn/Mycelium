"use client";

// Card matched to the reference: bare thumbnail on white with a small
// index number and quiet tag text beneath — no boxes, no rounded chrome.

import { useState } from "react";
import type { NodeItem } from "@/lib/types";
import { SourceBadge } from "./Icons";

interface NodeCardProps {
  node: NodeItem;
  index: number; // position in the current grid → "001", "002", …
  onOpen: (id: string) => void;
}

export default function NodeCard({ node, index, onOpen }: NodeCardProps) {
  const [imgBroken, setImgBroken] = useState(false);

  const busy =
    node.enrichment_status === "pending" || node.enrichment_status === "processing";
  const failed = node.enrichment_status === "failed";
  const showImage = !!node.thumbnail_url && !imgBroken;
  const num = String(index + 1).padStart(3, "0");

  return (
    <button
      onClick={() => onOpen(node.id)}
      className="group mb-8 block w-full text-left focus:outline-none sm:mb-10"
      aria-label={node.title || "Saved item"}
    >
      {/* Media / text preview */}
      <div className="relative">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.thumbnail_url!}
            alt={node.title || "Saved item"}
            loading="lazy"
            onError={() => setImgBroken(true)}
            className="w-full object-cover transition-opacity group-hover:opacity-90 group-focus-visible:opacity-90"
          />
        ) : (
          <div className="border border-line px-4 py-5 transition-colors group-hover:border-ink group-focus-visible:border-ink">
            <p className="text-xs font-medium leading-snug text-ink line-clamp-3">
              {node.title || "Untitled"}
            </p>
            {node.description && (
              <p className="mt-2 text-[11px] leading-relaxed text-dim line-clamp-5">
                {node.description}
              </p>
            )}
            {!node.description && imgBroken && (
              <p className="mt-2 text-[11px] text-dim">Preview image unavailable.</p>
            )}
          </div>
        )}
        <div className="absolute left-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <SourceBadge type={node.source_type} />
        </div>
      </div>

      {/* Caption row: index number + tags / shimmer / failed */}
      <div className="mt-2 flex items-baseline justify-between gap-3 text-[11px]">
        <span className="shrink-0 tabular-nums text-ink">{num}</span>
        {busy ? (
          <span className="flex gap-1.5" aria-label="Organizing this save">
            <span className="shimmer h-3 w-12" />
            <span className="shimmer h-3 w-8" />
          </span>
        ) : failed ? (
          <span className="truncate text-ember">failed — open to retry</span>
        ) : node.tags.length > 0 ? (
          <span className="truncate text-dim">
            {node.tags.slice(0, 3).join("  ·  ")}
            {node.tags.length > 3 ? `  +${node.tags.length - 3}` : ""}
          </span>
        ) : (
          <span className="text-dim/60">—</span>
        )}
      </div>
    </button>
  );
}
