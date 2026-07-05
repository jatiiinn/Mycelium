"use client";

import { useState } from "react";
import { CloseIcon } from "./Icons";

interface TagEditorProps {
  tags: string[];
  onSave: (tags: string[]) => Promise<void>;
}

export default function TagEditor({ tags, onSave }: TagEditorProps) {
  const [draft, setDraft] = useState<string[]>(tags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    draft.length !== tags.length || draft.some((t, i) => t !== tags[i]);

  function addFromInput() {
    const t = input.trim().toLowerCase().replace(/^#/, "");
    if (t && !draft.includes(t)) setDraft([...draft, t]);
    setInput("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save tags.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {draft.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1 text-[11px] text-ink"
          >
            {t}
            <button
              onClick={() => setDraft(draft.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
              className="text-dim transition-colors hover:text-ink"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addFromInput();
            }
          }}
          onBlur={addFromInput}
          placeholder="Add tag…"
          aria-label="Add tag"
          className="min-w-[90px] flex-1 border-b border-line bg-transparent px-1 py-1 text-[11px] text-ink placeholder:text-dim outline-none transition-colors focus:border-ink"
        />
      </div>
      {dirty && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-ink px-3 py-1.5 text-[11px] font-medium text-paper disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save tags"}
          </button>
          <button
            onClick={() => setDraft(tags)}
            className="text-[11px] text-dim transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <span className="text-[10px] text-dim">
            Saved tags stop being changed by auto-tagging.
          </span>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-ember">{error}</p>}
    </div>
  );
}
