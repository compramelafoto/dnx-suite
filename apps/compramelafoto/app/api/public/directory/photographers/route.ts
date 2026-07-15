import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listDirectoryPhotographers } from "@/lib/public/public-directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/directory/photographers
 * Fotógrafos con página pública habilitada (sin User.email).
 */
export async function GET() {
  try {
    const photographers = await listDirectoryPhotographers(prisma);
    return NextResponse.json(photographers);
  } catch (err: unknown) {
    console.error("GET /api/public/directory/photographers ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo fotógrafos" },
      { status: 500 }
    );
  }
}
