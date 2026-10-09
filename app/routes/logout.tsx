import { redirect } from "react-router";

import type { Route } from "./+types/logout";
import { clearSessionCookie } from "../lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  return redirect("/", { headers: { "Set-Cookie": clearSessionCookie(request) } });
}

export async function loader() {
  return redirect("/");
}
