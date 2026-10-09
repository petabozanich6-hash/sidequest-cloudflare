import { env } from "cloudflare:workers";
import { redirect } from "react-router";

const enc = new TextEncoder();
const COOKIE = "sq_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const ITERATIONS = 100_000; // Workers caps PBKDF2 at 100,000

function b64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function derive(plain: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(plain), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

export async function hashSecret(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(plain, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

export async function verifySecret(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = new Uint8Array(await derive(plain, unb64(salt), Number(iter)));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

function sessionSecret(): string {
  const s = (env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", enc.encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

type TokenPayload = { sub: string; role: "parent" | "child"; exp: number };

async function signToken(payload: TokenPayload): Promise<string> {
  const body = b64(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64(sig)}`;
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64(sig), enc.encode(body));
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64(body))) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieString(request: Request, value: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createSessionCookie(request: Request, sub: string, role: "parent" | "child") {
  const token = await signToken({ sub, role, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  return cookieString(request, token, MAX_AGE);
}

export function clearSessionCookie(request: Request) {
  return cookieString(request, "", 0);
}

function readCookie(request: Request): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
  return null;
}

export type SessionUser = {
  id: string;
  role: "parent" | "child";
  familyId: string;
  name: string;
};

export async function getUser(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const table = payload.role === "parent" ? "users" : "students";
  const row = await env.DB.prepare(`SELECT id, family_id, name FROM ${table} WHERE id = ?`)
    .bind(payload.sub)
    .first<{ id: string; family_id: string; name: string }>();
  if (!row) return null;
  return { id: row.id, role: payload.role, familyId: row.family_id, name: row.name };
}

export async function requireUser(request: Request, role?: "parent" | "child"): Promise<SessionUser> {
  const user = await getUser(request);
  if (!user) throw redirect("/login");
  if (role && user.role !== role) throw redirect("/dashboard");
  return user;
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
