// Mycelium enrichment worker — main loop.
// Every POLL_MS: reclaim stuck jobs, claim up to BATCH pending nodes, enrich
// them sequentially. Optionally pings the Vercel /api/sync route every 10
// minutes (reliable substitute for Vercel Cron on the Hobby plan).

import http from "node:http";
import { resetStuck, fetchPending, claim } from "./supabase.js";
import { processNode } from "./enrich.js";
import { log, logError } from "./log.js";

const POLL_MS = 60 * 1000;
const BATCH = 5;
const SYNC_EVERY_MS = 10 * 60 * 1000;

let lastSyncPing = 0;
let running = false;

async function pingSync(): Promise<void> {
  const url = process.env.SYNC_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) return;
  if (Date.now() - lastSyncPing < SYNC_EVERY_MS) return;
  lastSyncPing = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = await res.json().catch(() => ({}));
    log(`sync ping -> ${res.status}`, json);
  } catch (e) {
    logError("sync ping failed", e);
  }
}

async function tick(): Promise<void> {
  if (running) return; // don't overlap if a batch runs long
  running = true;
  try {
    await pingSync();
    await resetStuck();
    const pending = await fetchPending(BATCH);
    if (pending.length > 0) log(`found ${pending.length} pending node(s)`);
    for (const node of pending) {
      const claimed = await claim(node);
      if (!claimed) continue; // someone else got it / status changed
      await processNode(claimed);
    }
  } catch (e) {
    logError("tick failed", e);
  } finally {
    running = false;
  }
}

// Tiny health endpoint. Required if you deploy this as a Render *Web Service*
// (which needs an open port); harmless on a Background Worker.
const port = Number(process.env.PORT || 8080);
http
  .createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("mycelium worker ok\n");
  })
  .listen(port, () => log(`health endpoint on :${port}`));

log("mycelium worker started");
tick();
setInterval(tick, POLL_MS);
