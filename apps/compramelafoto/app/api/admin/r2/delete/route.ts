import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { deleteMultipleFromR2 } from "@/lib/r2-client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_KEYS_PER_REQUEST = 50;

export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const keys = Array.isArray(body?.keys) ? (body.keys as string[]).filter((k) => typeof k === "string") : [];

    if (keys.length === 0) {
      return NextResponse.json({ error: "Se requieren keys para eliminar" }, { status: 400 });
    }

    if (keys.length > MAX_KEYS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Máximo ${MAX_KEYS_PER_REQUEST} archivos por petición` },
        { status: 400 }
      );
    }

    await deleteMultipleFromR2(keys);

    await logAdminAction({
      action: "r2_delete",
      entityType: "R2",
      description: `Eliminados ${keys.length} archivos de R2`,
      afterData: { keysCount: keys.length, keys: keys.slice(0, 10) },
      ...getRequestMetadata(req),
    });

    return NextResponse.json({ deleted: keys.length });
  } catch (err) {
    console.error("[admin/r2/delete]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar" },
      { status: 500 }
    );
  }
}
