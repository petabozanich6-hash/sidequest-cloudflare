import { Form, data } from "react-router";
import { env } from "cloudflare:workers";

import type { Route } from "./+types/dashboard";
import { hashSecret, newId, nowIso, requireUser } from "../lib/auth.server";

const STAGES = [
  { code: "ES1", name: "Early Stage 1", band: "primary", theme: "early" },
  { code: "S1", name: "Stage 1", band: "primary", theme: "primary" },
  { code: "S2", name: "Stage 2", band: "primary", theme: "primary" },
  { code: "S3", name: "Stage 3", band: "primary", theme: "primary" },
  { code: "S4", name: "Stage 4", band: "secondary", theme: "secondary" },
  { code: "S5", name: "Stage 5", band: "secondary", theme: "secondary" },
  { code: "S6", name: "Stage 6", band: "senior", theme: "senior" },
];

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard | Side Quest" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  let students: { id: string; name: string; username: string; stage_name: string }[] = [];
  if (user.role === "parent") {
    const res = await env.DB.prepare(
      "SELECT id, name, username, stage_name FROM students WHERE family_id = ? ORDER BY created_at",
    ).bind(user.familyId).all<{ id: string; name: string; username: string; stage_name: string }>();
    students = res.results;
  }
  return { user, students };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request, "parent");
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const pin = String(form.get("pin") ?? "");
  const stage = STAGES.find((s) => s.code === form.get("stage"));

  if (!name || !/^[a-z0-9_]{3,20}$/.test(username) || !/^\d{4,8}$/.test(pin) || !stage) {
    return data({ error: "Name, a username (3-20 letters, numbers or _), a 4-8 digit PIN and a stage are required." }, { status: 400 });
  }
  const taken = await env.DB.prepare("SELECT id FROM students WHERE username = ?").bind(username).first();
  if (taken) return data({ error: "That username is already taken." }, { status: 400 });

  await env.DB.prepare(
    "INSERT INTO students (id, family_id, name, username, pin_hash, stage, stage_name, band, theme, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(newId(), user.familyId, name, username, await hashSecret(pin), stage.code, stage.name, stage.band, stage.theme, nowIso()).run();
  return { ok: true };
}

export default function Dashboard({ loaderData, actionData }: Route.ComponentProps) {
  const { user, students } = loaderData;
  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hello, {user.name}</h1>
        <Form method="post" action="/logout"><button className="rounded border px-3 py-1">Log out</button></Form>
      </header>

      {user.role === "child" ? (
        <p className="mt-6">Your quest page is coming soon: pet, lessons and rewards.</p>
      ) : (
        <>
          <h2 className="mt-8 text-xl font-semibold">Your children</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {students.length === 0 && <li className="text-gray-500">No children added yet.</li>}
            {students.map((s) => (
              <li key={s.id} className="rounded border p-3">{s.name} <span className="text-gray-500">({s.username}, {s.stage_name})</span></li>
            ))}
          </ul>

          <h2 className="mt-8 text-xl font-semibold">Add a child</h2>
          {actionData && "error" in actionData && <p className="mt-3 rounded bg-red-100 p-3 text-red-800">{actionData.error}</p>}
          <Form method="post" className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="name" placeholder="Child's name" required className="rounded border p-2" />
            <input name="username" placeholder="Username" required className="rounded border p-2" />
            <input name="pin" type="password" inputMode="numeric" placeholder="PIN (4-8 digits)" required className="rounded border p-2" />
            <select name="stage" required className="rounded border p-2">
              {STAGES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <button className="rounded bg-indigo-600 p-2 text-white sm:col-span-2">Add child</button>
          </Form>
        </>
      )}
    </main>
  );
}
