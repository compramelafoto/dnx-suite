import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { duplicateQuoteForUser } from "@/lib/cuantocobro/quote/quote-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type RouteContext = { params: Promise<{ id: string }> };

async function resolveQuoteId(ctx: RouteContext): Promise<number | null> {
  const { id } = await ctx.params;
  const quoteId = Number(id);
  return Number.isFinite(quoteId) && quoteId > 0 ? quoteId : null;
}

/** POST /api/cuantocobro/quotes/[id]/duplicate — duplica un presupuesto como borrador nuevo. */
export async function POST(_request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const quoteId = await resolveQuoteId(ctx);
  if (!quoteId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const quote = await duplicateQuoteForUser(user.id, quoteId);
  if (!quote) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ quote }, { status: 201 });
}
