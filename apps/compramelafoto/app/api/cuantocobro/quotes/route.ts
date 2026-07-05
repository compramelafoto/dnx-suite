import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { createQuoteForUser, listQuotesForUser } from "@/lib/cuantocobro/quote/quote-db";
import type { CreateCuantoCobroQuoteInput } from "@/lib/cuantocobro/quote/types";
import type { CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type PostBody = {
  quote?: unknown;
  consultaId?: unknown;
  quoteExpedienteId?: unknown;
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

function parseOptionalConsultaId(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num;
}

function parseOptionalQuoteExpedienteId(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num;
}

function parseQueryInt(value: string | null): number | null {
  if (!value?.trim()) return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : null;
}

/** GET /api/cuantocobro/quotes — listado paginado del usuario autenticado. */
export async function GET(request: Request) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const result = await listQuotesForUser({
    userId: user.id,
    cursor: searchParams.get("cursor"),
    limit: Number(searchParams.get("limit") ?? "50"),
    search: searchParams.get("search"),
    status: searchParams.get("status"),
    jobDateFrom: searchParams.get("jobDateFrom"),
    jobDateTo: searchParams.get("jobDateTo"),
    hasConsulta: searchParams.get("hasConsulta"),
    amountMin: parseQueryInt(searchParams.get("amountMin")),
    amountMax: parseQueryInt(searchParams.get("amountMax")),
    includeArchived: searchParams.get("includeArchived") === "1",
  });

  return NextResponse.json(result);
}

/** POST /api/cuantocobro/quotes — persiste un presupuesto y opcionalmente lo vincula a una consulta. */
export async function POST(request: Request) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
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
    consultaId: parseOptionalConsultaId(body.consultaId),
    quoteExpedienteId: parseOptionalQuoteExpedienteId(body.quoteExpedienteId),
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
    const quote = await createQuoteForUser(user.id, input);
    return NextResponse.json({ quote });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo guardar el presupuesto";
    const status =
      message === "Consulta no encontrada" || message === "Presupuesto no encontrado" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
