import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDirectoryCounts } from "@/lib/public/public-directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/directory/counts
 * Conteos agregados para Home / Header (sin PII).
 */
export async function GET() {
  try {
    const counts = await getDirectoryCounts(prisma);
    return NextResponse.json(counts);
  } catch (err: unknown) {
    console.error("GET /api/public/directory/counts ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo conteos" },
      { status: 500 }
    );
  }
}
