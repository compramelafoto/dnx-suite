import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { getEconomicIndexSuggestion } from "@/lib/cuantocobro/economic-data/economic-data-service";
import type { EconomicDataIndexType } from "@/lib/cuantocobro/economic-data/economic-data-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

const VALID_TYPES: EconomicDataIndexType[] = ["inflation", "interest_rate"];

function parseIndexType(raw: string | null): EconomicDataIndexType | null {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "inflation" || normalized === "interest_rate") return normalized;
  return null;
}

/** GET /api/cuantocobro/economic-indexes?country=AR&type=inflation|interest_rate */
export async function GET(request: Request) {
  const { error, user } = await requireAuth(ALLOWED_ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const countryCode = (searchParams.get("country") ?? "").trim().toUpperCase();
  const type = parseIndexType(searchParams.get("type"));

  if (!countryCode || countryCode.length !== 2) {
    return NextResponse.json({ error: "Parámetro country inválido." }, { status: 400 });
  }

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Parámetro type inválido. Usá inflation o interest_rate." },
      { status: 400 },
    );
  }

  const result = await getEconomicIndexSuggestion(countryCode, type);

  return NextResponse.json({
    available: result.available,
    countryCode: result.countryCode,
    type: result.type,
    sourceLabel: result.sourceLabel,
    queriedAt: result.queriedAt,
    latestPeriod: "latestPeriod" in result ? result.latestPeriod : undefined,
    latestMonthlyRate: "latestMonthlyRate" in result ? result.latestMonthlyRate : undefined,
    average3m: "average3m" in result ? result.average3m : undefined,
    average6m: "average6m" in result ? result.average6m : undefined,
    average12m: "average12m" in result ? result.average12m : undefined,
    suggestedMonthlyRate: "suggestedMonthlyRate" in result ? result.suggestedMonthlyRate : undefined,
    suggestedAnnualRate: "suggestedAnnualRate" in result ? result.suggestedAnnualRate : undefined,
    method: "method" in result ? result.method : undefined,
    message: "message" in result ? result.message : undefined,
  });
}
