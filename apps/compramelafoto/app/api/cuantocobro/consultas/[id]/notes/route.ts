import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { addConsultaNoteForUser } from "@/lib/cuantocobro/consulta/consulta-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type RouteContext = { params: Promise<{ id: string }> };

async function resolveConsultaId(ctx: RouteContext): Promise<number | null> {
  const params = await ctx.params;
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** POST /api/cuantocobro/consultas/[id]/notes */
export async function POST(request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const consultaId = await resolveConsultaId(ctx);
  if (!consultaId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: { body?: unknown };
  try {
    body = (await request.json()) as { body?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const noteBody = typeof body.body === "string" ? body.body.trim() : "";
  if (!noteBody) {
    return NextResponse.json({ error: "body requerido" }, { status: 400 });
  }

  const note = await addConsultaNoteForUser(user.id, consultaId, noteBody);
  if (!note) {
    return NextResponse.json({ error: "Consulta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, note }, { status: 201 });
}
