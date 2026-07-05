export function log(msg: string, extra?: unknown) {
  const ts = new Date().toISOString();
  if (extra !== undefined) {
    console.log(`[${ts}] ${msg}`, extra);
  } else {
    console.log(`[${ts}] ${msg}`);
  }
}

export function logError(msg: string, err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[${new Date().toISOString()}] ERROR ${msg}: ${detail}`);
}

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
