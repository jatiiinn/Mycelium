"use client";

import { useState } from "react";
import type { NodeItem } from "@/lib/types";
import { SourceBadge } from "./Icons";

interface NodeCardProps {
  node: NodeItem;
  onOpen: (id: string) => void;
}

export default function NodeCard({ node, onOpen }: NodeCardProps) {
  const [imgBroken, setImgBroken] = useState(false);

  const busy =
    node.enrichment_status === "pending" || node.enrichment_status === "processing";
  const failed = node.enrichment_status === "failed";
  const showImage = !!node.thumbnail_url && !imgBroken;

  return (
    <button
      onClick={() => onOpen(node.id)}
      className="group mb-3.5 block w-full overflow-hidden rounded-card border border-seam bg-surface text-left transition-colors hover:border-moss/60 focus:outline-none focus-visible:border-lichen sm:mb-4"
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
            className="w-full object-cover"
          />
        ) : (
          <div className="px-4 pb-2 pt-4">
            <p className="text-sm font-medium leading-snug text-fog line-clamp-3">
              {node.title || "Untitled"}
            </p>
            {node.description && (
              <p className="mt-2 text-xs leading-relaxed text-moss line-clamp-5">
                {node.description}
              </p>
            )}
            {!node.description && imgBroken && (
              <p className="mt-2 text-xs text-moss">Preview image unavailable.</p>
            )}
          </div>
        )}
        <div className="absolute left-2 top-2">
          <SourceBadge type={node.source_type} />
        </div>
      </div>

      {/* Footer: tags / shimmer / failed */}
      <div className="px-3 py-2.5">
        {showImage && (
          <p className="mb-1.5 truncate text-xs text-moss">{node.title || "Untitled"}</p>
        )}
        {busy ? (
          <div className="flex gap-1.5" aria-label="Organizing this save">
            <span className="shimmer h-5 w-14 rounded-full" />
            <span className="shimmer h-5 w-10 rounded-full" />
            <span className="shimmer h-5 w-16 rounded-full" />
          </div>
        ) : failed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-2.5 py-1 text-xs text-ember">
            <span className="h-1.5 w-1.5 rounded-full bg-ember" aria-hidden />
            Enrichment failed — open to retry
          </span>
        ) : node.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {node.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-raised px-2.5 py-1 text-xs text-lichen"
              >
                {t}
              </span>
            ))}
            {node.tags.length > 3 && (
              <span className="rounded-full px-1.5 py-1 text-xs text-moss">
                +{node.tags.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-moss">No tags</span>
        )}
      </div>
    </button>
  );
}
