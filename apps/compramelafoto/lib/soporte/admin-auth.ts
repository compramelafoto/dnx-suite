import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

/** Igual que las rutas de soporte de admin existentes: sólo rol ADMIN. */
export async function soloAdmin(): Promise<
  { ok: true; user: { id: number; name: string | null; email: string } } | { ok: false; res: NextResponse }
> {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return { ok: false, res: NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 401 }) };
  }
  return { ok: true, user: { id: user.id, name: user.name ?? null, email: user.email } };
}
