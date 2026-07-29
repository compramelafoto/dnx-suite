import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getConsultaForUser,
  softDeleteConsultaForUser,
  updateConsultaForUser,
} from "@/lib/cuantocobro/consulta/consulta-db";
import { normalizeCuantoCobroConsultaInput } from "@/lib/cuantocobro/consulta/normalize";
import type { CuantoCobroConsultaInput } from "@/lib/cuantocobro/consulta/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

function isConsultaBody(value: unknown): value is Partial<CuantoCobroConsultaInput> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type RouteContext = { params: Promise<{ id: string }> };

async function resolveConsultaId(ctx: RouteContext): Promise<number | null> {
  const params = await ctx.params;
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** GET /api/cuantocobro/consultas/[id] */
export async function GET(_request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const consultaId = await resolveConsultaId(ctx);
  if (!consultaId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const consulta = await getConsultaForUser(user.id, consultaId);
  if (!consulta) {
    return NextResponse.json({ error: "Consulta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ consulta });
}

/** PUT /api/cuantocobro/consultas/[id] */
export async function PUT(request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const consultaId = await resolveConsultaId(ctx);
  if (!consultaId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: { consulta?: unknown };
  try {
    body = (await request.json()) as { consulta?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isConsultaBody(body.consulta)) {
    return NextResponse.json({ error: "consulta requerida" }, { status: 400 });
  }

  const normalized = normalizeCuantoCobroConsultaInput(body.consulta);
  if (!normalized.title.trim()) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }

  const consulta = await updateConsultaForUser(user.id, consultaId, normalized);
  if (!consulta) {
    return NextResponse.json({ error: "Consulta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, consulta });
}

/** DELETE /api/cuantocobro/consultas/[id] — soft delete solo en borrador abierto. */
export async function DELETE(_request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const consultaId = await resolveConsultaId(ctx);
  if (!consultaId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const deleted = await softDeleteConsultaForUser(user.id, consultaId);
  if (!deleted) {
    return NextResponse.json(
      { error: "No se puede eliminar esta consulta (solo borradores abiertos)" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
