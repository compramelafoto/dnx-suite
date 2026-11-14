/**
 * Cron: guarda la cotización diaria contra el dólar de las monedas de CLF internacional (piloto).
 * Auth: Bearer CRON_SECRET (o x-cron-secret).
 */
import { NextRequest, NextResponse } from "next/server";
import { refreshFxRates } from "@/lib/international/fx-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-cron-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const { saved, missing } = await refreshFxRates();
    if (missing.length > 0) console.warn("[intl-fx] faltan cotizaciones", missing);
    return NextResponse.json({ ok: true, saved, missing });
  } catch (err) {
    console.error("[intl-fx] error", err);
    return NextResponse.json({ ok: false, error: "fx_fetch_failed" }, { status: 502 });
  }
}
