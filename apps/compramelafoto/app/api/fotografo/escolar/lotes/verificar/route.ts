import { NextRequest, NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { filtroDeLibritos, respuestaDeError } from "@/lib/design-v2/produccion-http";
import { zipDelLoteEscolar } from "@/lib/design-v2/zip-del-lote-escolar";
import { filasDelZip } from "@/lib/orders/print-export/verificacion";
import { verificarEnR2 } from "@/lib/orders/print-export/verificacion-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET ?lote=… [&formato=jpg] — «Verificar lote»: lo que recibe la imprenta en el ZIP de ese formato,
 * archivo por archivo, con los mismos nombres y en el mismo orden (lo arma `zipDelLoteEscolar`,
 * igual que la descarga). No marca nada: es una consulta.
 */
export async function GET(req: NextRequest) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const sp = req.nextUrl.searchParams;
    const formato = sp.get("formato") === "jpg" ? "jpg" : "pdf";
    const filtro = filtroDeLibritos({
      ids: sp.get("ids") ?? undefined,
      lote: sp.get("lote") ?? undefined,
      copias: sp.get("copias") ?? undefined,
    });
    const zip = await zipDelLoteEscolar(actor, filtro, formato, { conResumen: false });
    const nombreZip = `${zip.nombre}.zip`;
    return NextResponse.json({
      nombre: filtro.lote ?? zip.nombre,
      zips: [nombreZip],
      archivos: await verificarEnR2(filasDelZip(zip.plans, nombreZip)),
      omitidos: [],
      control: zip.control,
    });
  } catch (err) {
    return respuestaDeError(err, "verificar lote");
  }
}
