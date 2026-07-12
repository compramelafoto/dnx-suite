"use server";

import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import {
  canAccessInfoSpotAdmin,
  canAccessInfoSpotRedaccion,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { destroyInfoSpotSession } from "@/lib/session-cookie";
import { loadPostLoginDestination } from "@/lib/google-login";

/** Login email/contraseña: POST /api/auth/login (Set-Cookie en Route Handler). */

export async function logoutAction(): Promise<void> {
  await destroyInfoSpotSession();
  redirect("/ingresar");
}

/** Si ya hay sesión válida con acceso, ir directo al destino. */
export async function redirectIfAlreadySignedIn(next = "/redaccion") {
  const user = await getAuthUser();
  if (!user) return;
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  if (
    user.globalRole === "SUPER_ADMIN" ||
    canAccessInfoSpotRedaccion(subject) ||
    canAccessInfoSpotAdmin(subject)
  ) {
    const destination = await loadPostLoginDestination(user.id, user.role, next);
    redirect(destination.path);
  }
}
