import type { SourceType } from "@/lib/types";

// Minimal inline glyphs (drawn here, not brand assets) so cards can show
// where a save came from without pulling in an icon library.

type IconProps = { className?: string };

export function InstagramIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function XIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden>
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}

export function PinterestIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="10" r="6" />
      <path d="M11 8l-3 13" />
    </svg>
  );
}

export function LinkIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.5 1.5" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.5-1.5" />
    </svg>
  );
}

export function NoteIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 11h7M9 15h7" />
    </svg>
  );
}

export function ImageIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 18l5-5 4 4 3-3 4 4" />
    </svg>
  );
}

export function PlayIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </svg>
  );
}

export function PlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ExternalIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M14 4h6v6" />
      <path d="M20 4L10 14" />
      <path d="M18 13v6H5V6h6" />
    </svg>
  );
}

export function SourceBadge({ type }: { type: SourceType }) {
  const icon =
    type === "instagram_post" || type === "instagram_reel" ? (
      <InstagramIcon />
    ) : type === "x_post" ? (
      <XIcon />
    ) : type === "pinterest" ? (
      <PinterestIcon />
    ) : type === "image" ? (
      <ImageIcon />
    ) : type === "manual_note" ? (
      <NoteIcon />
    ) : (
      <LinkIcon />
    );

  const label =
    type === "instagram_reel"
      ? "Instagram reel"
      : type === "instagram_post"
      ? "Instagram post"
      : type === "x_post"
      ? "X post"
      : type === "pinterest"
      ? "Pinterest"
      : type === "image"
      ? "Image"
      : type === "manual_note"
      ? "Note"
      : "Link";

  return (
    <span
      title={label}
      className="inline-flex items-center justify-center rounded-full bg-ink/70 p-1.5 text-fog backdrop-blur-sm"
    >
      {icon}
      {type === "instagram_reel" && <PlayIcon className="ml-0.5 h-3 w-3" />}
    </span>
  );
}
