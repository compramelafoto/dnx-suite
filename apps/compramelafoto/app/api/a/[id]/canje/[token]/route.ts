import { NextRequest, NextResponse } from "next/server";
import {
  EXTERNAL_VOUCHER_ERROR_MESSAGES,
  loadExternalVoucherByToken,
} from "@/lib/canje-externo/external-voucher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/a/[id]/canje/[token]
 *
 * Estado del combo pagado por fuera, para el cartel de la galería. Público: el token es
 * el link único de la familia y sin él no se obtiene nada.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  const { id, token } = await params;
  const albumId = Number.parseInt(id, 10);
  if (!Number.isFinite(albumId) || albumId <= 0 || !token) {
    return NextResponse.json(
      { ok: false, error: EXTERNAL_VOUCHER_ERROR_MESSAGES.invalid },
      { status: 400 }
    );
  }
  const lookup = await loadExternalVoucherByToken(token, albumId);
  if (!lookup.ok) {
    return NextResponse.json(
      { ok: false, error: EXTERNAL_VOUCHER_ERROR_MESSAGES[lookup.error] },
      { status: 404 }
    );
  }
  const { refs, redeemed } = lookup.voucher;
  return NextResponse.json({
    ok: true,
    redeemed,
    printUnits: refs.printUnits,
    size: refs.size,
    includesDigital: refs.includesDigital,
    label: refs.label,
    studentName: refs.studentName,
    parentName: refs.parentName,
  });
}
