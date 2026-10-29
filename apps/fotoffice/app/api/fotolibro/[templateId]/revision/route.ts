import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { puedeEditarFotolibro } from "@/lib/fotolibro/permisos";
import {
  compartirConCliente,
  dejarDeCompartir,
  pedirAprobacionDeNuevo,
  resolverComentario,
  revisionDelFotolibro,
} from "@/lib/fotolibro/revision-cliente";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ templateId: string }> };

/** La revisión del cliente vista desde el estudio: estado, comentarios y si se cambió después. */
export async function GET(_req: Request, context: Ctx) {
  const user = await requireAuth();
  const { templateId } = await context.params;
  if (!(await puedeEditarFotolibro(user.id, templateId))) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  const r = await revisionDelFotolibro(templateId);
  const libro = await prisma.templateV2.findUnique({ where: { id: templateId }, select: { currentVersionId: true } });
  const version = libro?.currentVersionId ? await prisma.templateV2Version.findUnique({ where: { id: libro.currentVersionId }, select: { revision: true } }) : null;
  return NextResponse.json({ revision: r?.revision ?? null, revisionActual: version?.revision ?? 0 });
}

/**
 * Acciones del estudio: `compartir` (crea el enlace), `dejar` (lo corta), `de-nuevo` (vuelve a
 * pedir aprobación tras corregir) y `resolver` (marca un comentario).
 */
export async function POST(request: Request, context: Ctx) {
  const user = await requireAuth();
  const { templateId } = await context.params;
  if (!(await puedeEditarFotolibro(user.id, templateId))) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { accion?: string; id?: string; resuelto?: boolean };
  const libro = await prisma.templateV2.findUnique({ where: { id: templateId }, select: { ownerUserId: true } });
  if (!libro) return NextResponse.json({ error: "Ese fotolibro no existe." }, { status: 404 });
  if (body.accion === "compartir") return NextResponse.json({ revision: await compartirConCliente(templateId, libro.ownerUserId) });
  if (body.accion === "dejar") {
    await dejarDeCompartir(templateId);
    return NextResponse.json({ revision: (await revisionDelFotolibro(templateId))?.revision ?? null });
  }
  if (body.accion === "de-nuevo") return NextResponse.json({ revision: await pedirAprobacionDeNuevo(templateId) });
  if (body.accion === "resolver" && body.id) return NextResponse.json({ revision: await resolverComentario(templateId, body.id, body.resuelto !== false) });
  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}
