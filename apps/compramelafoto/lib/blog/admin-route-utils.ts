import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

/**
 * Admin del Blog CLF: alinea con layout `/admin` (ADMIN | SUPER_ADMIN).
 * No amplía a otros roles.
 */
export async function requireBlogAdmin() {
  const { error, user } = await requireAuth([Role.ADMIN, Role.SUPER_ADMIN]);
  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }),
    };
  }
  return { user, response: null };
}

export function parseRouteId(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export function handleBlogPrismaError(err: unknown, entityLabel: string) {
  const code = (err as { code?: string })?.code;
  if (code === "P2002") {
    return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
  }
  if (code === "P2025") {
    return NextResponse.json({ error: `${entityLabel} no encontrado` }, { status: 404 });
  }
  console.error(`Blog admin API error (${entityLabel}):`, err);
  return NextResponse.json({ error: `No se pudo procesar ${entityLabel}` }, { status: 500 });
}
