import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { markCuantoCobroUserAccess } from "@/lib/cuantocobro/user-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

/** Registra acceso del usuario autenticado a ¿Cuánto Cobro? */
export async function POST() {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  await markCuantoCobroUserAccess(user.id);

  return NextResponse.json({ ok: true });
}
