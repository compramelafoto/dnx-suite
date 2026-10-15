import "server-only";
import { prisma } from "@repo/db";
import { puede, rolEnMuestra } from "@/lib/equipo/permisos";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";
import { pdfGuardado } from "./certificado";
import { streamPrivado } from "./r2-privado";

/**
 * Descargas del panel (etapa 8, tarea 16): el original para imprimir y el certificado y la etiqueta
 * del dorso de cada copia impresa (o de una P/A). El permiso se relee en la base en cada pedido;
 * sin permiso, 404 (nunca se dice si existe).
 */
const SIN_CACHE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const noHay = (status = 404, texto = "No existe.") =>
  new Response(texto, { status, headers: { ...SIN_CACHE, "Content-Type": "text/plain; charset=utf-8" } });

async function puedePreparar(activityId: string): Promise<boolean> {
  const usuario = await getUsuario();
  if (!usuario) return false;
  if (!frenarPorUsuario("pedidosPanel", usuario.id).allowed) return false;
  const rol = await rolEnMuestra(activityId, usuario);
  return rol != null && (puede(usuario, "salesFulfill", rol.role) || puede(usuario, "sales", rol.role));
}

const nombreSeguro = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "obra";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/tiff": "tif" };

/** El original de una obra (por `activityWorkId`): quien prepara las copias de la muestra o su autor. */
export async function descargarOriginal(activityWorkId: string): Promise<Response> {
  if (!ES_ID.test(activityWorkId)) return noHay();
  const usuario = await getUsuario();
  if (!usuario) return noHay();
  const archivo = await prisma.culturalSaleFile.findUnique({
    where: { activityWorkId },
    select: { activityId: true, authorUserId: true, storageKey: true, status: true, mime: true },
  });
  if (!archivo || archivo.status !== "READY") return noHay();
  const esAutor = archivo.authorUserId === usuario.id;
  if (!esAutor && !(await puedePreparar(archivo.activityId))) return noHay();
  const obra = await prisma.culturalActivityWork.findUnique({ where: { id: activityWorkId }, select: { title: true } });
  const s = await streamPrivado(archivo.storageKey);
  if (!s) return noHay();
  const ext = EXT[archivo.mime ?? ""] ?? "jpg";
  return new Response(s.stream, {
    headers: {
      ...SIN_CACHE,
      "Content-Type": archivo.mime ?? "application/octet-stream",
      ...(s.bytes != null ? { "Content-Length": String(s.bytes) } : {}),
      "Content-Disposition": `attachment; filename="original-${nombreSeguro(obra?.title ?? "obra")}.${ext}"`,
    },
  });
}

/**
 * El certificado o la etiqueta del dorso: del pedido pagado (impreso para la etiqueta) o, con
 * `?copia=<id>`, de una prueba de autor emitida. Sólo copias `ISSUED` con certificado.
 */
export async function descargarPieza(req: Request, orderId: string, pieza: "certificado" | "etiqueta"): Promise<Response> {
  const copiaPa = new URL(req.url).searchParams.get("copia");
  let copyId: string;
  let activityId: string;
  if (copiaPa) {
    if (!ES_ID.test(copiaPa)) return noHay();
    const c = await prisma.culturalEditionCopy.findUnique({ where: { id: copiaPa }, select: { id: true, activityId: true, kind: true, status: true, orderId: true } });
    if (!c || c.kind !== "PROOF" || c.orderId != null) return noHay();
    if (!(await puedePreparar(c.activityId))) return noHay();
    if (c.status !== "ISSUED") return c.status === "VOIDED" ? noHay(410, "Esta copia fue anulada.") : noHay();
    copyId = c.id;
    activityId = c.activityId;
  } else {
    if (!ES_ID.test(orderId)) return noHay();
    const p = await prisma.culturalSaleOrder.findUnique({ where: { id: orderId }, select: { activityId: true, status: true, copyId: true, delivery: true } });
    if (!p?.copyId) return noHay();
    activityId = p.activityId;
    if (!(await puedePreparar(activityId))) return noHay();
    const c = await prisma.culturalEditionCopy.findUnique({ where: { id: p.copyId }, select: { status: true, orderId: true } });
    // La copia tiene que ser de este pedido (una copia soltada y vuelta a vender es de otro).
    if (!c || c.orderId !== orderId) return noHay();
    if (c.status === "VOIDED") return noHay(410, "Esta copia fue anulada.");
    if (p.status !== "PAID" || c.status !== "ISSUED") return noHay();
    if (pieza === "etiqueta" && p.delivery === "DIGITAL") return noHay();
    copyId = p.copyId;
  }
  const pdf = await pdfGuardado(copyId, pieza);
  if (!pdf) return noHay(409, "El certificado todavía no está listo. Probá en unos minutos.");
  const codigo = (await prisma.culturalEditionCopy.findUnique({ where: { id: copyId }, select: { certificateCode: true } }))?.certificateCode ?? "copia";
  return new Response(Buffer.from(pdf), {
    headers: { ...SIN_CACHE, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pieza}-${codigo}.pdf"` },
  });
}
