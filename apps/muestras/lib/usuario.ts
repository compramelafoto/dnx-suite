import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken, isGlobalSuperAdmin } from "@repo/auth";
import { prisma } from "@repo/db";

export type Usuario = { id: number; email: string; name: string | null; esSuperAdmin: boolean };

/** La persona con sesión abierta, o null. Lee la misma tabla `User` que FOTOFFICE y FotoRank. */
export async function getUsuario(): Promise<Usuario | null> {
  const token = (await cookies()).get(DNX_SESSION_COOKIE)?.value;
  if (!token) return null;
  const sesion = await getSessionUserByRawToken(token);
  if (!sesion) return null;
  const u = await prisma.user.findUnique({
    where: { id: sesion.id },
    select: { id: true, email: true, name: true, role: true, globalRole: true },
  });
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, esSuperAdmin: isGlobalSuperAdmin(u) };
}

export async function requireUsuario(siguiente: string): Promise<Usuario> {
  const u = await getUsuario();
  if (!u) redirect(`/login?next=${encodeURIComponent(siguiente)}`);
  return u;
}

export async function requireSuperAdmin(): Promise<Usuario> {
  const u = await requireUsuario("/panel/revision");
  if (!u.esSuperAdmin) redirect("/panel");
  return u;
}
