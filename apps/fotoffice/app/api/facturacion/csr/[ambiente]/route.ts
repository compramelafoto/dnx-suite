import { NextResponse } from "next/server";
import { contextoFacturacion } from "@/lib/invoicing/access";
import { esAmbiente } from "@/lib/invoicing/constants";
import { leerCsr } from "@/lib/invoicing/servicio";

export const dynamic = "force-dynamic";

/**
 * Descarga del pedido de certificado (CSR) para subir a ARCA. Es público por naturaleza (no tiene
 * la clave privada), pero igual se entrega sólo al dueño o a un administrador.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ ambiente: string }> }) {
  const c = await contextoFacturacion();
  if (!c || !c.puedeConfigurar) return NextResponse.json({ error: "Sólo el dueño o un administrador." }, { status: 403 });
  const { ambiente } = await params;
  const env = ambiente.toUpperCase();
  if (!esAmbiente(env)) return NextResponse.json({ error: "Ambiente inválido." }, { status: 400 });
  const csr = await leerCsr(c.workspace.id, env);
  if (!csr) return NextResponse.json({ error: "Todavía no se generó el pedido de este ambiente." }, { status: 404 });
  const nombre = `pedido-certificado-${env === "PRODUCCION" ? "produccion" : "homologacion"}-${csr.alias}.csr`;
  return new NextResponse(csr.csrPem, {
    headers: {
      "Content-Type": "application/pkcs10",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
