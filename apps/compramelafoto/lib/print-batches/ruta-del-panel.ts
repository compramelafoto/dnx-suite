import "server-only";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { LoteError } from "./servicio";

/**
 * Lo común a las rutas del panel «Impresiones»: sesión de fotógrafo, id numérico de la ruta y
 * respuesta de errores (`LoteError` → 400 con su texto; cualquier otro → 500 genérico).
 */

export const SIN_SESION = "No autorizado. Iniciá sesión como fotógrafo.";
const ERROR_GENERICO = "No se pudo completar la acción. Probá de nuevo.";

export async function fotografoDeLaSesion(): Promise<{ id: number } | NextResponse> {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || SIN_SESION }, { status: 401 });
  return { id: user.id };
}

export function idDeLaRuta(crudo: string): number | null {
  const id = Number(crudo);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function leerCuerpo(req: Request): Promise<Record<string, unknown> | null> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export function responderError(donde: string, err: unknown): NextResponse {
  if (err instanceof LoteError) return NextResponse.json({ error: err.message }, { status: 400 });
  console.error(`${donde} >>>`, err);
  return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
}
