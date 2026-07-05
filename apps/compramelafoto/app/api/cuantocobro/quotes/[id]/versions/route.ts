import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { createQuoteVersionForUser } from "@/lib/cuantocobro/quote/quote-db";
import type { CreateCuantoCobroQuoteInput } from "@/lib/cuantocobro/quote/types";
import type { CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type RouteContext = { params: Promise<{ id: string }> };

type PostBody = {
  quote?: unknown;
  profile?: unknown;
  calculationSnapshot?: unknown;
  versionComment?: unknown;
  currency?: unknown;
  chosenPriceCents?: unknown;
  recommendedPriceCents?: unknown;
  minimumPriceCents?: unknown;
  paymentOptionsSnapshot?: unknown;
  businessProfileSnapshot?: unknown;
};

function isQuoteBody(value: unknown): value is CuantoCobroQuoteInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.round(num);
}

async function resolveQuoteId(ctx: RouteContext): Promise<number | null> {
  const { id } = await ctx.params;
  const quoteId = Number(id);
  return Number.isFinite(quoteId) && quoteId > 0 ? quoteId : null;
}

/** POST /api/cuantocobro/quotes/[id]/versions — crea una nueva versión sobre el expediente. */
export async function POST(request: Request, ctx: RouteContext) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const quoteId = await resolveQuoteId(ctx);
  if (!quoteId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isQuoteBody(body.quote)) {
    return NextResponse.json({ error: "quote requerido" }, { status: 400 });
  }

  const input: CreateCuantoCobroQuoteInput = {
    quote: body.quote,
    profile:
      body.profile && typeof body.profile === "object" && !Array.isArray(body.profile)
        ? (body.profile as CreateCuantoCobroQuoteInput["profile"])
        : undefined,
    calculationSnapshot: body.calculationSnapshot,
    versionComment: typeof body.versionComment === "string" ? body.versionComment : undefined,
    currency: typeof body.currency === "string" ? body.currency : undefined,
    chosenPriceCents: parseOptionalInt(body.chosenPriceCents),
    recommendedPriceCents: parseOptionalInt(body.recommendedPriceCents),
    minimumPriceCents: parseOptionalInt(body.minimumPriceCents),
    paymentOptionsSnapshot:
      body.paymentOptionsSnapshot && typeof body.paymentOptionsSnapshot === "object"
        ? (body.paymentOptionsSnapshot as CreateCuantoCobroQuoteInput["paymentOptionsSnapshot"])
        : undefined,
    businessProfileSnapshot:
      body.businessProfileSnapshot && typeof body.businessProfileSnapshot === "object"
        ? (body.businessProfileSnapshot as CreateCuantoCobroQuoteInput["businessProfileSnapshot"])
        : undefined,
  };

  try {
    const quote = await createQuoteVersionForUser(user.id, quoteId, input);
    return NextResponse.json({ quote });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear la versión";
    const status = message === "Presupuesto no encontrado" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
