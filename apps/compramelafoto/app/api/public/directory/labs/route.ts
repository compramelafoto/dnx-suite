import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listDirectoryLabs } from "@/lib/public/public-directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/directory/labs
 * Labs APPROVED + activos + no suspendidos para Directorio / Comunidad.
 * Contrato distinto de /api/public/labs (impresión): incluye logo, redes y handler.
 */
export async function GET() {
  try {
    const labs = await listDirectoryLabs(prisma);
    return NextResponse.json(labs);
  } catch (err: unknown) {
    console.error("GET /api/public/directory/labs ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo laboratorios" },
      { status: 500 }
    );
  }
}
