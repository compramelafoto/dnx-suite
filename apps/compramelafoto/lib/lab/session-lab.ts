import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decideLabSessionAccess } from "./session-lab-access";

/**
 * Devuelve el laboratorio de la persona en sesión, o la respuesta de error lista
 * para devolver (401 sin sesión, 403 sin rol de laboratorio, 404 sin laboratorio).
 */
export async function requireSessionLab(): Promise<
  { labId: number; response: null } | { labId: null; response: NextResponse }
> {
  const user = await getAuthUser();
  const lab = user
    ? await prisma.lab.findUnique({ where: { userId: user.id }, select: { id: true } })
    : null;
  const decision = decideLabSessionAccess(user, lab);
  if (!decision.ok) {
    return {
      labId: null,
      response: NextResponse.json({ error: decision.error }, { status: decision.status }),
    };
  }
  return { labId: decision.labId, response: null };
}
