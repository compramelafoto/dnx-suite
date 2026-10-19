import { NextResponse } from "next/server";
import {
  FILTER_SIGNATURE_HEADER,
  applyFilterDecisions,
  parseFilterDecisions,
  verifyFilterSignature,
} from "@/lib/agencies/filter-signal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Señal interna firmada del filtro de la nube: aprueba o descarta fotos de agencias en espera. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyFilterSignature(process.env.AGENCY_FILTER_SIGNAL_SECRET, request.headers.get(FILTER_SIGNATURE_HEADER), raw, Date.now())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = parseFilterDecisions((body as { decisions?: unknown } | null)?.decisions);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const results = await applyFilterDecisions(parsed.decisions);
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
