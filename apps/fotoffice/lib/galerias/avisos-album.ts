import "server-only";
import { prisma } from "@repo/db";
import { escapeHtml } from "@/lib/communications/html";
import { sendTransactionalEmail, type OutboundEmail } from "@/lib/communications/send-email";
import { correoValido } from "@/lib/plantillas/contexto";
import { inicioDelDiaAR } from "@/lib/plantillas/envio";
import { destinatarioDelPresupuesto } from "@/lib/presupuestos/avisos";
import { TOPE_AVISOS_ESTUDIO_DIA } from "./avisos";
import type { DecisionAlbum } from "./constantes";
import { limpiarAsunto } from "./asunto";
import { registrarEventoSinFallar } from "./eventos";

/**
 * Cuando el cliente aprueba el álbum o pide cambios (etapa 7, Entrega C), siempre después de responderle (`after()`):
 * un aviso interno al responsable de la galería (o al dueño del estudio si ya no está en el equipo), con la decisión,
 * el mensaje y el enlace a la ficha. Mismo tope diario que el aviso de la selección. Nunca lanza; el resultado queda
 * en el historial sin datos personales.
 */

export type DatosAvisoAlbum = {
  workspaceId: string;
  galeriaId: string;
  galeriaClienteId: string;
  rondaNumero: number;
  decision: DecisionAlbum;
  mensaje: string | null;
  comentarios: number;
};
export type DepsAvisoAlbum = { ahora?: () => Date; enviarInterno?: (m: OutboundEmail) => ReturnType<typeof sendTransactionalEmail>; appOrigin?: string };
export type ResultadoAvisoAlbum = "ENVIADO" | "NO_ENVIADO" | "SIN_DESTINATARIO" | "SIN_CORREO" | "TOPE" | "ERROR";

export async function avisarDecisionAlbum(d: DatosAvisoAlbum, deps: DepsAvisoAlbum = {}): Promise<ResultadoAvisoAlbum> {
  let resultado: ResultadoAvisoAlbum = "ERROR";
  try {
    const ahora = (deps.ahora ?? (() => new Date()))();
    const [c, g] = await Promise.all([
      prisma.fotofficeGaleriaCliente.findFirst({ where: { id: d.galeriaClienteId, workspaceId: d.workspaceId, galeriaId: d.galeriaId }, select: { id: true, name: true } }),
      prisma.fotofficeGaleria.findFirst({ where: { id: d.galeriaId, workspaceId: d.workspaceId }, select: { id: true, number: true, name: true, ownerUserId: true } }),
    ]);
    if (!c || !g) return resultado;
    resultado = await enviar(d, g, c, ahora, deps);
    await registrarEventoSinFallar({
      workspaceId: d.workspaceId, galeriaId: g.id, galeriaClienteId: c.id,
      tipo: resultado === "ENVIADO" ? "AVISO_ESTUDIO_ENVIADO" : "AVISO_ESTUDIO_NO_ENVIADO",
      ...(resultado === "ENVIADO" ? {} : { data: { motivo: resultado === "TOPE" ? "TOPE" : resultado === "SIN_DESTINATARIO" || resultado === "SIN_CORREO" ? "SIN_CORREO" : "NO_ENVIADO" } }),
    });
  } catch (e) {
    console.error("[galerias] falló el aviso de la decisión del álbum", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
  }
  return resultado;
}

async function enviar(
  d: DatosAvisoAlbum,
  g: { id: string; number: string; name: string; ownerUserId: number | null },
  c: { name: string },
  ahora: Date,
  deps: DepsAvisoAlbum,
): Promise<ResultadoAvisoAlbum> {
  const hoy = await prisma.fotofficeGaleriaEvento.count({ where: { workspaceId: d.workspaceId, type: "AVISO_ESTUDIO_ENVIADO", createdAt: { gte: inicioDelDiaAR(ahora) } } });
  if (hoy >= TOPE_AVISOS_ESTUDIO_DIA) return "TOPE";
  const para = await destinatarioDelPresupuesto(d.workspaceId, g.ownerUserId);
  if (para === null) return "SIN_DESTINATARIO";
  const usuario = await prisma.user.findUnique({ where: { id: para }, select: { email: true } });
  if (!correoValido(usuario?.email)) return "SIN_CORREO";
  const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
  const enlace = origen ? `${origen}/galerias/${encodeURIComponent(g.id)}/clientes/${encodeURIComponent(d.galeriaClienteId)}?ronda=${d.rondaNumero}` : null;
  const aprobo = d.decision === "APROBADO";
  const comentarios = d.comentarios === 1 ? "1 comentario" : `${d.comentarios} comentarios`;
  const lineas = [
    "Hola:",
    "",
    aprobo
      ? `${c.name} aprobó el álbum ${g.number} (${g.name}), ronda ${d.rondaNumero}.`
      : `${c.name} pidió cambios en el álbum ${g.number} (${g.name}), ronda ${d.rondaNumero}.`,
    `Dejó ${d.comentarios === 0 ? "ningún comentario en las láminas" : comentarios + " en las láminas"}.`,
    ...(d.mensaje ? ["", "Su mensaje:", d.mensaje] : []),
    ...(enlace ? ["", enlace] : []),
  ];
  const html = lineas.map((l) => (l === "" ? "<br>" : l === enlace ? `<p><a href="${escapeHtml(l)}">Revisar la prueba de álbum</a></p>` : `<p style="white-space:pre-line">${escapeHtml(l)}</p>`)).join("");
  const mandar = deps.enviarInterno ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
  const asunto = limpiarAsunto(aprobo ? `${c.name} aprobó el álbum ${g.name}` : `${c.name} pidió cambios en el álbum ${g.name}`);
  const r = await mandar({ to: usuario!.email!, subject: asunto, html, text: lineas.join("\n") });
  return r.status === "SENT" ? "ENVIADO" : "NO_ENVIADO";
}
