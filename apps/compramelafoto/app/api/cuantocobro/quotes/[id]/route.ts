import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { archiveQuoteForUser, getQuoteDetailForUser } from "@/lib/cuantocobro/quote/quote-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type RouteContext = { params: Promise<{ id: string }> };

async function resolveQuoteId(ctx: RouteContext): Promise<number | null> {
  const { id } = await ctx.params;
  const quoteId = Number(id);
  return Number.isFinite(quoteId) && quoteId > 0 ? quoteId : null;
}

/** GET /api/cuantocobro/quotes/[id] — detalle de un presupuesto. */
export async function GET(_request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const quoteId = await resolveQuoteId(ctx);
  if (!quoteId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const quote = await getQuoteDetailForUser(user.id, quoteId);
  if (!quote) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ quote });
}

/** PATCH /api/cuantocobro/quotes/[id] — archivar presupuesto. */
export async function PATCH(request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const quoteId = await resolveQuoteId(ctx);
  if (!quoteId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (body.action !== "archive") {
    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  }

  const archived = await archiveQuoteForUser(user.id, quoteId);
  if (!archived) {
    return NextResponse.json({ error: "Presupuesto no encontrado o ya archivado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
