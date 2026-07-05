import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createConsultaForUser,
  listConsultasForUser,
} from "@/lib/cuantocobro/consulta/consulta-db";
import { normalizeCuantoCobroConsultaInput } from "@/lib/cuantocobro/consulta/normalize";
import type { CuantoCobroConsultaInput } from "@/lib/cuantocobro/consulta/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

function isConsultaBody(value: unknown): value is Partial<CuantoCobroConsultaInput> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** GET /api/cuantocobro/consultas — listado paginado del usuario autenticado. */
export async function GET(request: Request) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const result = await listConsultasForUser({
    userId: user.id,
    cursor: searchParams.get("cursor"),
    limit: Number(searchParams.get("limit") ?? "50"),
    search: searchParams.get("search"),
    status: searchParams.get("status"),
    pipelineStage: searchParams.get("pipelineStage"),
    includeArchived: searchParams.get("includeArchived") === "1",
  });

  return NextResponse.json(result);
}

/** POST /api/cuantocobro/consultas — crea una consulta comercial. */
export async function POST(request: Request) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
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

  const consulta = await createConsultaForUser(user.id, normalized);

  return NextResponse.json({ ok: true, consulta }, { status: 201 });
}
