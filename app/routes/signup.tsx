import { Form, Link, data, redirect } from "react-router";
import { env } from "cloudflare:workers";

import type { Route } from "./+types/signup";
import { createSessionCookie, hashSecret, newId, nowIso } from "../lib/auth.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create account | Side Quest" }];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const familyName = String(form.get("family_name") ?? "").trim();

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return data({ error: "Enter your name, a valid email and a password of at least 8 characters." }, { status: 400 });
  }
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return data({ error: "That email is already registered." }, { status: 400 });

  const familyId = newId();
  const userId = newId();
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO families (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(familyId, familyName || `${name}'s Family`, userId, now),
    env.DB.prepare("INSERT INTO users (id, family_id, email, password_hash, name, is_owner, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
      .bind(userId, familyId, email, await hashSecret(password), name, now),
  ]);

  return redirect("/dashboard", { headers: { "Set-Cookie": await createSessionCookie(request, userId, "parent") } });
}

export default function Signup({ actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-md p-8 pt-20">
      <h1 className="text-2xl font-bold">Create parent account</h1>
      {actionData?.error && <p className="mt-4 rounded bg-red-100 p-3 text-red-800">{actionData.error}</p>}
      <Form method="post" className="mt-6 flex flex-col gap-3">
        <input name="name" placeholder="Your name" required className="rounded border p-2" />
        <input name="family_name" placeholder="Family name (optional)" className="rounded border p-2" />
        <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
        <input name="password" type="password" placeholder="Password (8+ characters)" required className="rounded border p-2" />
        <button className="rounded bg-indigo-600 p-2 text-white">Create account</button>
      </Form>
      <p className="mt-4 text-sm">Already have an account? <Link to="/login" className="underline">Log in</Link></p>
    </main>
  );
}
