import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { getQuoteVersionDetailForUser } from "@/lib/cuantocobro/quote/quote-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type RouteContext = { params: Promise<{ id: string; versionNumber: string }> };

async function resolveParams(ctx: RouteContext): Promise<{ quoteId: number; versionNumber: number } | null> {
  const { id, versionNumber: versionRaw } = await ctx.params;
  const quoteId = Number(id);
  const versionNumber = Number(versionRaw);
  if (!Number.isFinite(quoteId) || quoteId <= 0) return null;
  if (!Number.isFinite(versionNumber) || versionNumber <= 0) return null;
  return { quoteId, versionNumber };
}

/** GET /api/cuantocobro/quotes/[id]/versions/[versionNumber] — snapshot congelado de una versión. */
export async function GET(_request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const params = await resolveParams(ctx);
  if (!params) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const version = await getQuoteVersionDetailForUser(user.id, params.quoteId, params.versionNumber);
  if (!version) {
    return NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ version });
}
