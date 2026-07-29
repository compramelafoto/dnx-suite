import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { runAlbumConfigurationDiagnostics } from "@/lib/album-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const result = await runAlbumConfigurationDiagnostics(albumId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (err: any) {
    console.error("GET /api/admin/albums/[id]/diagnostics ERROR >>>", err);
    return NextResponse.json(
      { error: "Error generando diagnóstico", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
