import "server-only";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { DesignProjectError, type DesignActor } from "./projects";

const DESIGN_ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

/** El usuario que revisa diseños, o la respuesta 401 para devolver tal cual. */
export async function requireDesignActor(): Promise<DesignActor | NextResponse> {
  const { error, user } = await requireAuth(DESIGN_ROLES);
  if (error || !user) {
    return NextResponse.json({ ok: false, error: "Iniciá sesión para continuar." }, { status: 401 });
  }
  return { id: user.id, role: String(user.role) };
}

export function designErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof DesignProjectError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  console.error(`[design_v2] ${context}`, err);
  return NextResponse.json({ ok: false, error: "Algo falló. Probá de nuevo en un momento." }, { status: 500 });
}

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Nombre de archivo seguro para descargas. */
export function fileSlug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "diseno"
  );
}
