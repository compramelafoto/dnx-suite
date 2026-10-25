import "server-only";
import sharp from "sharp";
import { prisma } from "@repo/db";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { C, FUENTE, escapeHtml } from "@/lib/communications/html";
import { sendTransactionalEmail, type SendOutcome } from "@/lib/communications/send-email";
import { DETAIL_MAX } from "@/lib/communications/constants";
import { correoValido } from "@/lib/plantillas/contexto";
import { leerObjeto } from "./almacen";
import { mmAPx } from "./medidas";
import { validarReceta } from "./receta";
import { renderizarPieza } from "./render";
import { preparacionPropia, type CtxImpresion, type R } from "./preparaciones";

/**
 * La foto carnet como archivo: la pieza sola (sin plancha ni líneas de corte), a 300 ppp, para
 * entregarla en mano (descarga) o por mail. Sirve para el producto "Archivo digital" y también
 * para mandarle al cliente una copia de la carnet impresa. Se arma al pedirla, desde el original:
 * no se guarda (es chica y la receta ya está guardada).
 */

export const PPP_ARCHIVO = 300;

const cm = (mm: number) => String(Math.round(mm) / 10).replace(".", ",");

export type ArchivoCarnet = { jpg: Buffer; nombre: string; medida: string };

export async function archivoCarnet(workspaceId: string, preparacionId: string): Promise<ArchivoCarnet | null> {
  const prep = await preparacionPropia(workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return null;
  const pieza = await prisma.fotofficePiezaImpresion.findFirst({
    where: { workspaceId, preparacionId: prep.id, tipo: "CARNET" },
    select: { originalId: true, anchoMm: true, altoMm: true, receta: true },
  });
  const receta = pieza ? validarReceta(pieza.receta) : null;
  if (!pieza || !receta) return null;
  const original = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: pieza.originalId, workspaceId },
    select: { key: true },
  });
  if (!original) return null;
  const anchoMm = Number(pieza.anchoMm);
  const altoMm = Number(pieza.altoMm);
  const raw = await renderizarPieza(
    await leerObjeto(original.key),
    receta,
    { ancho: mmAPx(anchoMm, PPP_ARCHIVO), alto: mmAPx(altoMm, PPP_ARCHIVO) },
    "NORMAL",
  );
  const jpg = await sharp(raw.data, { raw: { width: raw.ancho, height: raw.alto, channels: 3 } })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .withIccProfile("srgb")
    .withMetadata({ density: PPP_ARCHIVO })
    .toBuffer();
  const medida = `${cm(anchoMm)} x ${cm(altoMm)} cm`;
  return { jpg, nombre: `foto-carnet-${cm(anchoMm)}x${cm(altoMm)}.jpg`, medida };
}

/**
 * Producto "Archivo digital": con la foto ya encuadrada, la preparación queda entregada (IMPRESA),
 * así no espera en la cola de impresión. Una preparación de otro producto no se toca.
 */
export async function marcarArchivoEntregado(ctx: CtxImpresion, preparacionId: string): Promise<void> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep?.productId || prep.estado === "ANULADA") return;
  const digital = await prisma.fotofficeProductoProduccion.count({
    where: { workspaceId: ctx.workspaceId, productId: prep.productId, unidad: "ARCHIVO" },
  });
  if (digital === 0) return;
  await prisma.fotofficePreparacionImpresion.updateMany({
    where: { id: prep.id, workspaceId: ctx.workspaceId, estado: { not: "ANULADA" } },
    data: { estado: "IMPRESA" },
  });
}

/** El texto del mail: corto, con el nombre del negocio y la medida, sin datos del cliente. */
export function correoFotoCarnet(d: { negocio: string | null; medida: string }): { subject: string; html: string; text: string } {
  const firma = d.negocio ?? "el estudio";
  const subject = "Tu foto carnet";
  const text = `Hola:\n\nTe enviamos tu foto carnet (${d.medida}) en el archivo adjunto, lista para usar en tu trámite.\n\nGracias por elegirnos.\n${firma}`;
  const html = `<!doctype html><html><body style="margin:0;background:${C.lienzo};font-family:${FUENTE};color:${C.cuerpo}">
<div style="max-width:520px;margin:0 auto;padding:24px">
<div style="background:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;padding:24px;line-height:1.5">
<p style="margin:0 0 12px;color:${C.tinta};font-size:18px;font-weight:600">Tu foto carnet</p>
<p style="margin:0 0 12px">Hola:</p>
<p style="margin:0 0 12px">Te enviamos tu foto carnet (${escapeHtml(d.medida)}) en el archivo adjunto, lista para usar en tu trámite.</p>
<p style="margin:0">Gracias por elegirnos.<br>${escapeHtml(firma)}</p>
</div></div></body></html>`;
  return { subject, html, text };
}

/**
 * Manda la foto carnet al mail que escribió quien atiende. Deja constancia en `SentEmailLog`
 * (sin el adjunto). Nunca lanza: el error vuelve como texto para mostrar.
 */
export async function enviarFotoCarnetPorMail(ctx: CtxImpresion, preparacionId: string, email: unknown): Promise<R> {
  const to = typeof email === "string" ? email.trim() : "";
  if (!correoValido(to)) return { ok: false, error: "Ese mail no es válido." };
  let archivo: ArchivoCarnet | null;
  try {
    archivo = await archivoCarnet(ctx.workspaceId, preparacionId);
  } catch (e) {
    console.error("[fotoffice][impresion] no se pudo armar el archivo para el mail", { error: e instanceof Error ? e.name : "?" });
    return { ok: false, error: "No se pudo armar la foto. Probá de nuevo." };
  }
  if (!archivo) return { ok: false, error: "Primero armá la foto." };
  const sender = await loadWorkspaceSender(ctx.workspaceId);
  const cuerpo = correoFotoCarnet({ negocio: sender.name, medida: archivo.medida });
  let outcome: SendOutcome;
  try {
    outcome = await sendTransactionalEmail({
      to,
      ...cuerpo,
      sender,
      attachments: [{ filename: archivo.nombre, content: new Uint8Array(archivo.jpg), contentType: "image/jpeg" }],
    });
  } catch (e) {
    outcome = { status: "INTERNAL_ERROR", detail: e instanceof Error ? e.message : "error desconocido" };
  }
  try {
    await prisma.sentEmailLog.create({
      data: {
        to,
        subject: cuerpo.subject,
        templateKey: "FOTO_CARNET",
        status: outcome.status,
        resendId: outcome.status === "SENT" ? outcome.providerId : null,
        error: outcome.status === "SENT" ? null : outcome.detail.slice(0, DETAIL_MAX),
        userId: ctx.userId,
      },
    });
  } catch {
    // El registro es diagnóstico: el mail ya salió (o no) y eso no cambia.
    console.error("[fotoffice][impresion] no se pudo registrar el envío de la foto carnet");
  }
  if (outcome.status === "SENT") return { ok: true };
  if (outcome.status === "CONFIGURATION_ERROR") return { ok: false, error: "El envío de mails no está configurado. Avisale al administrador." };
  return { ok: false, error: "No se pudo enviar el mail. Probá de nuevo." };
}
