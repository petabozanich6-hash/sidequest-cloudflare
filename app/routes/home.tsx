import { Link, redirect } from "react-router";

import type { Route } from "./+types/home";
import { getUser } from "../lib/auth.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Side Quest Learning" },
    { name: "description", content: "A home learning companion for NSW families." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) throw redirect("/dashboard");
  return null;
}

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8 pt-24 text-center">
      <h1 className="text-4xl font-bold">Side Quest Learning</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-300">
        A home learning companion for NSW families.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link to="/login" className="rounded bg-indigo-600 px-5 py-2 text-white">Log in</Link>
        <Link to="/signup" className="rounded border px-5 py-2">Create parent account</Link>
      </div>
    </main>
  );
}
