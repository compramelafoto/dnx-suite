import "server-only";
import QRCode from "qrcode";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { armarPdfComprobante, numeroComprobante } from "./pdf";
import { urlQr } from "./qr";
import type { EmisorSnapshot } from "./repositorio";
import type { Concepto } from "./constants";

/** El logo del negocio, si se puede bajar rápido y es PNG o JPG. Sin logo el PDF sale igual. */
async function logoDe(workspaceId: string): Promise<{ bytes: Uint8Array; tipo: "png" | "jpg" } | null> {
  const b = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { logoUrl: true } });
  if (!b?.logoUrl || !/^https:\/\//.test(b.logoUrl)) return null;
  try {
    const r = await fetch(b.logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > 5_000_000) return null;
    if (tipo.includes("png")) return { bytes, tipo: "png" };
    if (tipo.includes("jpeg") || tipo.includes("jpg")) return { bytes, tipo: "jpg" };
    return null;
  } catch {
    return null;
  }
}

/** El PDF de un comprobante autorizado (o de una factura ya anulada, que sigue siendo válida como documento). */
export async function pdfDeComprobante(workspaceId: string, id: string): Promise<{ ok: true; bytes: Uint8Array; nombre: string } | { ok: false; error: string }> {
  const f = await prisma.fotofficeInvoice.findFirst({
    where: { id, workspaceId },
    include: { items: { orderBy: { order: "asc" } }, relatedInvoice: { select: { pointOfSale: true, cbteNumero: true } } },
  });
  if (!f) return { ok: false, error: "No encontramos ese comprobante." };
  if (!f.cae || !f.caeVto || f.cbteNumero === null || (f.status !== "AUTORIZADA" && f.status !== "ANULADA")) {
    return { ok: false, error: "El comprobante todavía no está autorizado por ARCA." };
  }
  const emisor = f.emisorSnapshot as unknown as EmisorSnapshot;
  const totalMinor = decimalArsToMinor(f.impTotal);
  const url = urlQr({
    fecha: f.cbteFch,
    cuit: emisor.cuit,
    ptoVta: f.pointOfSale,
    tipoCmp: f.cbteTipo,
    nroCmp: f.cbteNumero,
    totalCentavos: totalMinor,
    tipoDocRec: f.receptorDocTipo,
    nroDocRec: f.receptorDocNro,
    cae: f.cae,
  });
  const [qrPng, logo, branding] = await Promise.all([
    QRCode.toBuffer(url, { margin: 1, width: 320 }),
    logoDe(workspaceId),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { commercialName: true } }),
  ]);
  const bytes = await armarPdfComprobante({
    cbteTipo: f.cbteTipo,
    ptoVta: f.pointOfSale,
    numero: f.cbteNumero,
    fecha: f.cbteFch,
    concepto: f.concepto as Concepto,
    servicio: f.servDesde && f.servHasta && f.vtoPago ? { desde: f.servDesde, hasta: f.servHasta, vtoPago: f.vtoPago } : null,
    emisor: { ...emisor, nombreComercial: branding?.commercialName ?? null },
    receptor: { docTipo: f.receptorDocTipo, docNro: f.receptorDocNro, nombre: f.receptorName, ivaCondition: f.receptorIvaCondition, domicilio: f.receptorDomicilio },
    renglones: f.items.map((i) => ({ description: i.description, qty: i.qty, unitPriceMinor: decimalArsToMinor(i.unitPriceArs), lineTotalMinor: decimalArsToMinor(i.lineTotalArs) })),
    totalMinor,
    cae: f.cae,
    caeVto: f.caeVto,
    asociado: f.relatedInvoice && f.relatedInvoice.cbteNumero !== null ? { ptoVta: f.relatedInvoice.pointOfSale, numero: f.relatedInvoice.cbteNumero } : null,
    esPrueba: f.environment !== "PRODUCCION",
    qrPng: new Uint8Array(qrPng),
    logo,
  });
  const tipo = f.cbteTipo === 13 ? "nota-de-credito-C" : "factura-C";
  return { ok: true, bytes, nombre: `${tipo}-${numeroComprobante(f.pointOfSale, f.cbteNumero)}.pdf` };
}
