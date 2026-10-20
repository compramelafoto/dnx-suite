import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireSalesStaff } from "@/lib/sales/access";
import { leerObjeto } from "@/lib/impresion/almacen";

export const dynamic = "force-dynamic";

/** La vista previa (1600 px, sRGB) de un original, para el editor. Privada: sólo quien vende. */
export async function GET(_: Request, { params }: { params: Promise<{ originalId: string }> }) {
  const { workspace } = await requireSalesStaff();
  const { originalId } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(originalId)) return new NextResponse(null, { status: 404 });
  const o = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: workspace.id, estado: "LISTO" },
    select: { previewKey: true },
  });
  if (!o?.previewKey) return new NextResponse(null, { status: 404 });
  const buf = await leerObjeto(o.previewKey);
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
