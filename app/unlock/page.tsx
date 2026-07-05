"use client";

import { useState } from "react";

export default function UnlockPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Wrong passcode.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-xs">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 text-lg tracking-wide text-fog">
            <span className="h-1.5 w-1.5 rounded-full bg-lichen" aria-hidden />
            mycelium
          </span>
          <p className="mt-2 text-sm text-moss">Enter your passcode to open your saves.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          aria-label="Passcode"
          className="w-full rounded-card border border-seam bg-surface px-4 py-3 text-fog placeholder:text-moss outline-none focus:border-lichen"
        />
        {error && <p className="mt-3 text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={busy || !passcode}
          className="mt-4 w-full rounded-card bg-lichen px-4 py-3 font-medium text-ink transition-opacity disabled:opacity-40"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
