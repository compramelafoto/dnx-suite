import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { buildQuotePdfForVersion } from "@/lib/cuantocobro/quote/quote-delivery-db";

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

/** GET /api/cuantocobro/quotes/[id]/versions/[versionNumber]/pdf — PDF comercial congelado (auth). */
export async function GET(_request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const params = await resolveParams(ctx);
  if (!params) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    const pdf = await buildQuotePdfForVersion(user.id, params.quoteId, params.versionNumber);
    if (!pdf) {
      return NextResponse.json({ error: "Versión no encontrada o sin datos congelados" }, { status: 404 });
    }

    return new NextResponse(Buffer.from(pdf.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[cuantocobro/pdf] Error generando PDF:", err);
    const message = err instanceof Error ? err.message : "Error al generar el PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
