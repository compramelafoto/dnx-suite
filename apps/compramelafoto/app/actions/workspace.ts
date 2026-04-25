"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionIdentityByRawToken } from "@repo/auth";
import { COMPRAMELAFOTO_WORKSPACE_COOKIE } from "@/lib/auth";

export async function setComprameLaFotoActiveWorkspace(
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = workspaceId.trim();
  if (!id) return { ok: false, error: "Workspace inválido." };

  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (!raw) return { ok: false, error: "Sesión no encontrada." };

  const identity = await getSessionIdentityByRawToken(raw, { currentWorkspaceId: id });
  const allowed = identity?.workspaces.some((w) => w.workspaceId === id) ?? false;
  if (!allowed) return { ok: false, error: "No tenés acceso a ese workspace." };

  cookieStore.set(COMPRAMELAFOTO_WORKSPACE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  revalidatePath("/", "layout");

  return { ok: true };
}
