import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { listR2ObjectsWithDetails } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const prefix = (searchParams.get("prefix") ?? "").replace(/\/+$/, "");
    const normalizedPrefix = prefix ? `${prefix}/` : "";

    const result = await listR2ObjectsWithDetails(normalizedPrefix, {
      maxObjects: 500,
      maxMs: 15_000,
      delimiter: "/",
    });

    return NextResponse.json({
      objects: result.objects,
      prefixes: result.prefixes,
      isTruncated: result.isTruncated,
      currentPrefix: normalizedPrefix || "/",
    });
  } catch (err) {
    console.error("[admin/r2/list]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar objetos" },
      { status: 500 }
    );
  }
}
