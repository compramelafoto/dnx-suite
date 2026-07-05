import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { loadPlatformHealthSnapshot } from "@/lib/admin/platform-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/platform-health
 * Snapshot agregado de salud operativa (<300 ms objetivo).
 */
export async function GET() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  try {
    const snapshot = await loadPlatformHealthSnapshot();
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err: unknown) {
    console.error("[platform-health]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
