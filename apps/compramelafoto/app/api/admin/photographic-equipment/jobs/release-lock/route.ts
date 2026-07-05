import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { forceReleaseExifDeviceScanLease } from "@/lib/photographic-equipment/scan-lease";
import { clearExifDeviceScanLockOnState } from "@/lib/photographic-equipment/scan-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/photographic-equipment/jobs/release-lock
 * Libera un lease de escaneo EXIF atascado (p. ej. tras timeout de Vercel).
 */
export async function POST() {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
  }

  const lease = await forceReleaseExifDeviceScanLease();
  await clearExifDeviceScanLockOnState();

  console.info("[exif-device-scan:release-lock]", {
    adminUserId: user.id,
    lease,
  });

  return NextResponse.json({
    ok: true,
    message: "Bloqueo de escaneo EXIF liberado.",
    lease,
  });
}
