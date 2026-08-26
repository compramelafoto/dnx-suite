import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runR2StagingSmoke } from "../../../../lib/fotorank/storage/r2-staging.smoke";

/**
 * Smoke R2 staging vía provider canónico FotoRank.
 * Solo Preview (nunca Production). Requiere header x-fotorank-ops-smoke.
 * No imprime secretos ni URLs firmadas completas.
 */
function authorized(req: Request): boolean {
  const expected = process.env.FOTORANK_OPS_SMOKE_SECRET?.trim() ?? "";
  if (!expected || expected.length < 24) return false;
  const provided = req.headers.get("x-fotorank-ops-smoke")?.trim() ?? "";
  if (!provided || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "Forbidden", reason: "Smoke disabled on Production" },
      { status: 403 },
    );
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json(
      { error: "Forbidden", reason: `Smoke only on Preview (got ${process.env.VERCEL_ENV})` },
      { status: 403 },
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runR2StagingSmoke();
  return NextResponse.json(
    {
      final: result.final,
      reportText: result.reportText,
      json: result.json,
    },
    { status: result.final === "PASS" ? 200 : result.final === "BLOCKED" ? 503 : 500 },
  );
}
