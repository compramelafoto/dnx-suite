import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { sendQuoteVersionToClient } from "@/lib/cuantocobro/quote/quote-delivery-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type RouteContext = { params: Promise<{ id: string; versionNumber: string }> };

type PostBody = {
  to?: unknown;
  subject?: unknown;
  message?: unknown;
  includePdf?: unknown;
  includeLink?: unknown;
  confirmed?: unknown;
};

async function resolveParams(ctx: RouteContext): Promise<{ quoteId: number; versionNumber: number } | null> {
  const { id, versionNumber: versionRaw } = await ctx.params;
  const quoteId = Number(id);
  const versionNumber = Number(versionRaw);
  if (!Number.isFinite(quoteId) || quoteId <= 0) return null;
  if (!Number.isFinite(versionNumber) || versionNumber <= 0) return null;
  return { quoteId, versionNumber };
}

/** POST /api/cuantocobro/quotes/[id]/versions/[versionNumber]/send — envía presupuesto al cliente. */
export async function POST(request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const params = await resolveParams(ctx);
  if (!params) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await sendQuoteVersionToClient(user.id, params.quoteId, params.versionNumber, {
      to: typeof body.to === "string" ? body.to : "",
      subject: typeof body.subject === "string" ? body.subject : "",
      message: typeof body.message === "string" ? body.message : "",
      includePdf: body.includePdf !== false,
      includeLink: body.includeLink !== false,
      confirmed: body.confirmed === true,
    });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo enviar el presupuesto";
    const status =
      message === "Versión no encontrada" ||
      message === "La versión no tiene un cálculo congelado válido"
        ? 404
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
