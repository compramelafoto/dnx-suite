"use server";

import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { destroyInfoSpotSession } from "@/lib/session-cookie";
import { loadPostLoginDestination } from "@/lib/google-login";

/** Login email/contraseña: POST /api/auth/login (Set-Cookie en Route Handler). */

export async function logoutAction(): Promise<void> {
  await destroyInfoSpotSession();
  redirect("/ingresar");
}

/** Si ya hay sesión válida, ir al destino post-login (público o editorial). */
export async function redirectIfAlreadySignedIn(next = "/") {
  const user = await getAuthUser();
  if (!user) return;
  const destination = await loadPostLoginDestination(user.id, user.role, next);
  redirect(destination.path);
}
