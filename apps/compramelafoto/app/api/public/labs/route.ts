import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listPublicLabs } from "@/lib/public/public-labs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/labs?search=
 * Lista laboratorios activos (no suspendidos) para /imprimir-publico.
 * Sin auth. No expone tokens MP ni notas internas.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const labs = await listPublicLabs(prisma, search);
    return NextResponse.json(labs, { status: 200 });
  } catch (err: unknown) {
    console.error("GET /api/public/labs ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error obteniendo laboratorios",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
