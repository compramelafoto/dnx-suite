import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listDirectoryOrganizers } from "@/lib/public/public-directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/directory/organizers
 * Organizadores con landing publicada y logo.
 * publicEmail/whatsapp son campos explícitos del perfil público.
 */
export async function GET() {
  try {
    const organizers = await listDirectoryOrganizers(prisma);
    return NextResponse.json(organizers);
  } catch (err: unknown) {
    console.error("GET /api/public/directory/organizers ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo organizadores" },
      { status: 500 }
    );
  }
}
