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
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-xs">
        <div className="mb-10 text-center">
          <span className="text-sm tracking-wide text-ink">Mycelium</span>
          <p className="mt-2 text-xs text-dim">Enter your passcode to open your saves.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          aria-label="Passcode"
          className="w-full border border-line bg-paper px-4 py-3 text-sm text-ink placeholder:text-dim outline-none transition-colors focus:border-ink"
        />
        {error && <p className="mt-3 text-xs text-ember">{error}</p>}
        <button
          type="submit"
          disabled={busy || !passcode}
          className="mt-4 w-full bg-ink px-4 py-3 text-sm font-medium text-paper transition-opacity disabled:opacity-40"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
