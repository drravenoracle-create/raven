import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AdminSession = {
  email: string;
  exp: number;
};

export const ADMIN_SESSION_COOKIE = "raven_admin_session";
export const GOOGLE_STATE_COOKIE = "raven_google_oauth_state";

const DEFAULT_ADMIN_EMAIL = "dr.ravenoracle@gmail.com";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export function adminEmail() {
  return process.env.RAVEN_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
}

export function googleRedirectUri(origin: string) {
  return `${origin}/api/admin/auth/google/callback`;
}

export function publicOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export function adminSessionMaxAge() {
  return SESSION_TTL_SECONDS;
}

export async function requireGoogleAdmin(returnTo: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session && session.email.toLowerCase() === adminEmail().toLowerCase()) {
    return session;
  }

  redirect(`/api/admin/auth/google/start?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!value) return null;

  const session = await verifySession(value);
  if (!session) return null;
  if (session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

export async function createSessionCookie(email: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64UrlEncode(JSON.stringify({ email, exp } satisfies AdminSession));
  const signature = await hmac(payload);
  return `${payload}.${signature}`;
}

export function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncodeBytes(bytes);
}

export function safeRelativeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/admin/";
  }

  if (url.origin !== "https://app.local") return "/admin/";
  if (url.pathname.startsWith("/api/admin/auth/")) return "/admin/";
  return `${url.pathname}${url.search}${url.hash}`;
}

async function verifySession(value: string): Promise<AdminSession | null> {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = await hmac(payload);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as AdminSession;
    if (!data.email || typeof data.exp !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

async function hmac(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured.");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
