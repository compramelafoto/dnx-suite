import { NextResponse } from "next/server";
import { contextoFacturacion } from "@/lib/invoicing/access";
import { pdfDeComprobante } from "@/lib/invoicing/pdf-servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/** El PDF de un comprobante autorizado. Sólo para quien ve Facturación en este workspace. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await contextoFacturacion();
  if (!c) return NextResponse.json({ error: "No tenés acceso a Facturación." }, { status: 403 });
  const { id } = await params;
  if (!ID_VALIDO.test(id)) return NextResponse.json({ error: "Comprobante inválido." }, { status: 400 });
  const r = await pdfDeComprobante(c.workspace.id, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 404 });
  return new NextResponse(Buffer.from(r.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
