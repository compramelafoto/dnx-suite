import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { ingestPartnerImpression } from "@repo/db/partners-impression-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Beacon de impresión CLF. Soft-fail; no PII.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      trackingKey?: string;
      creativeId?: string;
      placementKey?: string;
      viewSessionKey?: string;
    } | null;
    if (!body?.trackingKey || !body?.creativeId || !body?.placementKey) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const ua = request.headers.get("user-agent");
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const result = await ingestPartnerImpression(prisma, {
      trackingKey: body.trackingKey,
      creativeId: body.creativeId,
      placementKey: body.placementKey,
      application: "COMPRAME_LA_FOTO",
      viewSessionKey: body.viewSessionKey,
      userAgent: ua,
      clientSeed: forwarded || "anon",
    });
    return NextResponse.json({ ok: true, tracked: result.ok ? result.tracked : false });
  } catch {
    return NextResponse.json({ ok: true, tracked: false });
  }
}
