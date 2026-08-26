/**
 * Password gate for the browser UI.
 *
 * The password lives only in RGC_PRIVATE_PASS and is compared on the server; it
 * never reaches the client bundle. What the browser holds is a cookie carrying
 * an expiry plus an HMAC of that expiry keyed by the password, so it cannot be
 * forged without knowing the password and cannot be extended by editing it.
 *
 * The gate is active only when RGC_PRIVATE_PASS is set and non-empty. Unset
 * means no password exists to check, so the site is open — setting the variable
 * is what turns the gate on.
 *
 * Scope: this gates the browser UI. The assets themselves are in a public
 * GitHub repo and served from a public CDN, so anyone holding a url can still
 * fetch the file. This is UI-gating, not access control over the assets.
 *
 * Web Crypto only, so the same code runs in Edge middleware and in a route.
 */
const enc = new TextEncoder();

export const GATE_COOKIE = "rgc_gate";
export const GATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const secret = () => process.env.RGC_PRIVATE_PASS ?? "";
export const gateEnabled = () => secret().length > 0;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message))));
}

async function sha256(value: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}

/** Constant time for equal-length inputs; callers always pass digests. */
function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compare a submitted password without leaking its length through timing. */
export async function passwordMatches(submitted: string): Promise<boolean> {
  return sameDigest(await sha256(submitted), await sha256(secret()));
}

export async function issueToken(): Promise<string> {
  const expiry = String(Date.now() + GATE_TTL_MS);
  return `${expiry}.${await hmac(expiry)}`;
}

export async function tokenIsValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiry, signature] = token.split(".");
  if (!expiry || !signature) return false;
  const at = Number(expiry);
  if (!Number.isFinite(at) || at < Date.now()) return false;
  return sameDigest(signature, await hmac(expiry));
}
