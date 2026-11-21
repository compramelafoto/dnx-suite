import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { decideFotografoClientesAccess } from "./clientes-sesion-access";

/**
 * Devuelve el id del fotógrafo en sesión, o la respuesta de error lista para
 * devolver (401 sin sesión, 403 si la cuenta no es de fotógrafo).
 */
export async function requireSessionPhotographer(): Promise<
  { photographerId: number; response: null } | { photographerId: null; response: NextResponse }
> {
  const auth = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  const decision = decideFotografoClientesAccess(auth);
  if (!decision.ok) {
    return {
      photographerId: null,
      response: NextResponse.json({ error: decision.error }, { status: decision.status }),
    };
  }
  return { photographerId: decision.photographerId, response: null };
}
