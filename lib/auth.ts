// Shared auth helpers (Edge-runtime compatible: uses Web Crypto only).

export const AUTH_COOKIE = "mycelium_auth";
const SALT = "mycelium-v1::";

export async function passcodeHash(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + passcode);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
