import { Form, Link, data, redirect } from "react-router";
import { env } from "cloudflare:workers";

import type { Route } from "./+types/login";
import { createSessionCookie, getUser, verifySecret } from "../lib/auth.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Log in | Side Quest" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) throw redirect("/dashboard");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "child") {
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const pin = String(form.get("pin") ?? "");
    const s = await env.DB.prepare("SELECT id, pin_hash FROM students WHERE username = ?")
      .bind(username).first<{ id: string; pin_hash: string }>();
    if (!s || !(await verifySecret(pin, s.pin_hash))) {
      return data({ error: "Invalid username or PIN.", which: "child" }, { status: 401 });
    }
    return redirect("/dashboard", { headers: { "Set-Cookie": await createSessionCookie(request, s.id, "child") } });
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const u = await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email).first<{ id: string; password_hash: string | null }>();
  if (!u || !(await verifySecret(password, u.password_hash))) {
    return data({ error: "Invalid email or password.", which: "parent" }, { status: 401 });
  }
  return redirect("/dashboard", { headers: { "Set-Cookie": await createSessionCookie(request, u.id, "parent") } });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto grid max-w-3xl gap-8 p-8 pt-20 md:grid-cols-2">
      <section>
        <h1 className="text-2xl font-bold">Parent login</h1>
        {actionData?.which === "parent" && <p className="mt-3 rounded bg-red-100 p-3 text-red-800">{actionData.error}</p>}
        <Form method="post" className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="intent" value="parent" />
          <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
          <input name="password" type="password" placeholder="Password" required className="rounded border p-2" />
          <button className="rounded bg-indigo-600 p-2 text-white">Log in</button>
        </Form>
        <p className="mt-4 text-sm">New here? <Link to="/signup" className="underline">Create an account</Link></p>
      </section>
      <section>
        <h2 className="text-2xl font-bold">Student login</h2>
        {actionData?.which === "child" && <p className="mt-3 rounded bg-red-100 p-3 text-red-800">{actionData.error}</p>}
        <Form method="post" className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="intent" value="child" />
          <input name="username" placeholder="Username" required className="rounded border p-2" />
          <input name="pin" type="password" inputMode="numeric" placeholder="PIN" required className="rounded border p-2" />
          <button className="rounded bg-emerald-600 p-2 text-white">Start quest</button>
        </Form>
      </section>
    </main>
  );
}
