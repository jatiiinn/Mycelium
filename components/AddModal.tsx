"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "./Icons";

type Tab = "link" | "image" | "note";

interface AddModalProps {
  onClose: () => void;
  onAdded: () => void;
}

export default function AddModal({ onClose, onAdded }: AddModalProps) {
  const [tab, setTab] = useState<Tab>("link");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (tab === "image") {
        if (!file) throw new Error("Choose an image first.");
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());
        res = await fetch("/api/upload", { method: "POST", body: form });
      } else {
        res = await fetch("/api/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            tab === "link"
              ? { kind: "link", url, title: title.trim() || undefined }
              : { kind: "note", text, title: title.trim() || undefined }
          ),
        });
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Couldn't add that. Try again.");
      }
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "link", label: "Link" },
    { id: "image", label: "Image" },
    { id: "note", label: "Note" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Add a save"
    >
      <form
        onSubmit={submit}
        className="relative w-full max-w-md border border-line bg-paper p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 p-1.5 text-dim transition-colors hover:text-ink"
        >
          <CloseIcon />
        </button>

        <h2 className="text-sm font-medium text-ink">Add to Mycelium</h2>
        <p className="mt-1 text-[11px] text-dim">
          It gets tagged and summarized automatically after saving.
        </p>

        {/* Tabs — quiet text row with underline, like the reference nav */}
        <div className="mt-5 flex items-center gap-1.5 border-b border-line pb-2 text-xs">
          {tabs.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="text-dim/60" aria-hidden>
                  /
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setError(null);
                }}
                className={
                  tab === t.id
                    ? "text-ink underline underline-offset-4"
                    : "text-dim transition-colors hover:text-ink"
                }
              >
                {t.label}
              </button>
            </span>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {tab === "link" && (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              aria-label="Link URL"
              required
              className="w-full border border-line bg-paper px-3.5 py-2.5 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-ink"
            />
          )}

          {tab === "image" && (
            <label className="block cursor-pointer border border-dashed border-line px-3.5 py-7 text-center text-xs text-dim transition-colors hover:border-ink">
              {file ? (
                <span className="text-ink">{file.name}</span>
              ) : (
                "Tap to choose an image (up to 15 MB)"
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          {tab === "note" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your note…"
              aria-label="Note text"
              required
              rows={5}
              className="w-full resize-y border border-line bg-paper px-3.5 py-2.5 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-ink"
            />
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            aria-label="Title"
            className="w-full border border-line bg-paper px-3.5 py-2.5 text-xs text-ink placeholder:text-dim outline-none transition-colors focus:border-ink"
          />
        </div>

        {error && <p className="mt-3 text-xs text-ember">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full bg-ink px-4 py-2.5 text-xs font-medium text-paper disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
