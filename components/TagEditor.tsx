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
            className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs text-lichen"
          >
            {t}
            <button
              onClick={() => setDraft(draft.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
              className="text-moss hover:text-fog"
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
          className="min-w-[90px] flex-1 rounded-full border border-seam bg-surface px-3 py-1 text-xs text-fog placeholder:text-moss outline-none focus:border-lichen"
        />
      </div>
      {dirty && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-lichen px-3 py-1 text-xs font-medium text-ink disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save tags"}
          </button>
          <button
            onClick={() => setDraft(tags)}
            className="rounded-full px-2 py-1 text-xs text-moss hover:text-fog"
          >
            Cancel
          </button>
          <span className="text-[11px] text-moss">
            Saved tags stop being changed by auto-tagging.
          </span>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-ember">{error}</p>}
    </div>
  );
}
