import "server-only";
import { prisma } from "@repo/db";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { correoValido } from "@/lib/plantillas/contexto";
import type { DepsEnvio } from "@/lib/plantillas/envio";
import { destinatarioDelPresupuesto } from "@/lib/presupuestos/avisos";
import { leerObjetoContrato } from "./almacen";
import { enviarCorreoContrato, type ResultadoCorreoContrato } from "./correos";
import { registrarEvento } from "./eventos";
import { generarPdfContrato, huellaPdf, type DepsPdf } from "./pdf";
import { nombreArchivoPdf } from "./pdf-documento";

/**
 * Lo que pasa cuando un contrato queda firmado por todos (etapa 5): se genera el PDF sellado y se manda
 * una copia con el PDF adjunto a cada firmante y a la organización (correo de contacto de la marca; si no
 * tiene, el del responsable o dueño).
 *
 * - `alFirmarContrato` (en `firma.ts`) lo llama con `after()`: nunca frena la firma y nunca lanza.
 * - El cron diario lo reintenta para los contratos FIRMADO que quedaron sin PDF o sin enviar.
 * - El envío se RESERVA marcando `pdfSentAt` con un UPDATE condicional (gana una sola corrida). Si todos
 *   los envíos fallaron por algo que se puede reintentar (proveedor caído, tope diario), la reserva se
 *   suelta y se reintenta. Si al menos una copia salió, se da por enviado: reintentar mandaría de nuevo
 *   a quienes ya la recibieron. Una plantilla apagada o un firmante sin correo no se reintentan.
 */

export type DepsSellado = DepsEnvio & DepsPdf;

export type ResultadoSellado =
  | { ok: true; pdf: "GENERADO" | "YA_EXISTIA"; envio: ResultadoEnvioPdf }
  | { ok: false; codigo: string };

export type ResultadoEnvioPdf = "ENVIADO" | "YA_ENVIADO" | "PENDIENTE" | "SIN_DESTINATARIOS" | "SIN_PDF" | "ERROR";

const REINTENTABLES: readonly ResultadoCorreoContrato[] = ["NO_ENVIADO", "ERROR", "TOPE"];

function registrarFalla(donde: string, e: unknown): void {
  const err = e as { name?: string; code?: unknown } | null;
  console.error(`[contratos] ${donde} falló`, { error: err?.name ?? "desconocido", codigo: typeof err?.code === "string" ? err.code : null });
}

/** Manda el PDF a los firmantes y a la organización. Nunca lanza. */
export async function enviarPdfFirmado(contratoId: string, deps: DepsSellado = {}): Promise<ResultadoEnvioPdf> {
  try {
    const ahora = (deps.ahora ?? (() => new Date()))();
    const leer = deps.leer ?? leerObjetoContrato;
    const c = await prisma.fotofficeContrato.findFirst({
      where: { id: contratoId },
      select: { id: true, workspaceId: true, number: true, status: true, currentVersionId: true, ownerUserId: true, pdfKey: true, pdfHash: true, pdfSentAt: true },
    });
    if (!c || c.status !== "FIRMADO" || !c.pdfKey || !c.pdfHash || !c.currentVersionId) return "SIN_PDF";
    if (c.pdfSentAt) return "YA_ENVIADO";

    let bytes: Uint8Array;
    try {
      bytes = await leer(c.pdfKey);
    } catch (e) {
      registrarFalla("leer el PDF para enviarlo", e);
      return "PENDIENTE";
    }
    if (huellaPdf(bytes) !== c.pdfHash) {
      console.error("[contratos] el PDF guardado no coincide con su huella", { codigo: "HUELLA_PDF_DISTINTA" });
      return "ERROR";
    }

    const [firmantes, org] = await Promise.all([
      prisma.fotofficeContratoFirmante.findMany({
        where: { workspaceId: c.workspaceId, versionId: c.currentVersionId },
        orderBy: [{ orden: "asc" }],
        select: { name: true, email: true },
      }),
      loadWorkspaceEmailContext(c.workspaceId),
    ]);
    const destinos: { para: string; nombre: string }[] = [];
    const vistos = new Set<string>();
    const sumar = (para: string | null | undefined, nombre: string) => {
      if (!correoValido(para)) return;
      const k = para!.trim().toLowerCase();
      if (vistos.has(k)) return;
      vistos.add(k);
      destinos.push({ para: para!.trim(), nombre });
    };
    for (const f of firmantes) sumar(f.email, f.name);
    let correoOrg = org.contact?.email ?? null;
    if (!correoValido(correoOrg)) {
      try {
        const userId = await destinatarioDelPresupuesto(c.workspaceId, c.ownerUserId);
        const u = userId === null ? null : await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        correoOrg = u?.email ?? null;
      } catch (e) {
        registrarFalla("buscar el correo de la organización", e);
      }
    }
    sumar(correoOrg, org.organizationName);
    if (destinos.length === 0) return "SIN_DESTINATARIOS";

    // Reserva: gana una sola corrida.
    const reserva = await prisma.fotofficeContrato.updateMany({ where: { id: c.id, workspaceId: c.workspaceId, pdfSentAt: null }, data: { pdfSentAt: ahora } });
    if (reserva.count !== 1) return "YA_ENVIADO";

    const adjuntos = [{ filename: nombreArchivoPdf(c.number), content: bytes, contentType: "application/pdf" }];
    const resultados: ResultadoCorreoContrato[] = [];
    for (const d of destinos) {
      resultados.push(
        await enviarCorreoContrato(
          { workspaceId: c.workspaceId, clave: "CONTRATO_FIRMADO", contratoId: c.id, para: d.para, nombre: d.nombre, numero: c.number, adjuntos },
          { enviar: deps.enviar, ahora: deps.ahora },
        ),
      );
    }
    const enviados = resultados.filter((r) => r === "ENVIADO").length;
    const reintentables = resultados.filter((r) => REINTENTABLES.includes(r)).length;
    if (enviados === 0 && reintentables > 0) {
      await prisma.fotofficeContrato.updateMany({ where: { id: c.id, workspaceId: c.workspaceId, pdfSentAt: ahora }, data: { pdfSentAt: null } });
      console.warn("[contratos] el PDF firmado no salió; se reintenta", { codigo: "PDF_NO_ENVIADO" });
      return "PENDIENTE";
    }
    try {
      await registrarEvento(prisma, { workspaceId: c.workspaceId, contratoId: c.id, tipo: "PDF_ENVIADO", data: { enviados, sinEnviar: resultados.length - enviados } });
    } catch (e) {
      registrarFalla("registrar el envío del PDF", e);
    }
    return enviados > 0 ? "ENVIADO" : "SIN_DESTINATARIOS";
  } catch (e) {
    registrarFalla("enviar el PDF firmado", e);
    return "ERROR";
  }
}

/** Genera el PDF (si falta) y manda las copias (si faltan). Nunca lanza. */
export async function finalizarContratoFirmado(contratoId: string, deps: DepsSellado = {}): Promise<ResultadoSellado> {
  try {
    const g = await generarPdfContrato(contratoId, deps);
    if (!g.ok) return { ok: false, codigo: g.codigo };
    const envio = await enviarPdfFirmado(contratoId, deps);
    return { ok: true, pdf: g.yaExistia ? "YA_EXISTIA" : "GENERADO", envio };
  } catch (e) {
    registrarFalla("sellar el contrato", e);
    return { ok: false, codigo: "ERROR" };
  }
}
