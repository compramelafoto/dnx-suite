import "server-only";
import { prisma } from "@repo/db";
import { escapeHtml } from "@/lib/communications/html";
import { sendTransactionalEmail, type OutboundEmail, type SendOutcome } from "@/lib/communications/send-email";
import { inicioDelDiaAR } from "@/lib/plantillas/envio";
import { esTablaFaltante } from "./dominio";

/**
 * Aviso al equipo cuando entra un testimonio por el formulario o por una invitación: un correo
 * interno al dueño (como el aviso de consulta nueva, `CONSULTA_AVISO_EQUIPO`, sale con el remitente
 * de FOTOFFICE). Se apaga en los ajustes de Testimonios (`avisarAlEquipo`, encendido por omisión).
 *
 * Tope: pasados `TOPE_AVISOS_TESTIMONIO_DIA` testimonios en el día (de Buenos Aires) ya no se avisa
 * más: si un robot pasa el freno, el dueño no recibe cien correos.
 *
 * Nunca lanza: el testimonio ya quedó guardado. Los errores van al registro sólo con su código.
 */

export const TOPE_AVISOS_TESTIMONIO_DIA = 20;
export const RUTA_PANEL_TESTIMONIOS = "/website/testimonios";

export type ResultadoAvisoTestimonio = "ENVIADO" | "APAGADO" | "TOPE" | "SIN_DESTINATARIO" | "NO_ENVIADO" | "ERROR";

export type DepsAvisoTestimonio = {
  ahora?: () => Date;
  enviar?: (m: OutboundEmail) => Promise<SendOutcome>;
  appOrigin?: string;
};

async function avisarAlEquipoEncendido(workspaceId: string): Promise<boolean> {
  try {
    const a = await prisma.fotofficeTestimonioAjustes.findUnique({ where: { workspaceId }, select: { avisarAlEquipo: true } });
    return a?.avisarAlEquipo ?? true;
  } catch (err) {
    if (esTablaFaltante(err)) return true;
    throw err;
  }
}

function correoDelAviso(p: { estudio: string; autor: string; texto: string; enlace: string }): Omit<OutboundEmail, "to"> {
  const resumen = p.texto.length > 300 ? `${p.texto.slice(0, 300).trimEnd()}…` : p.texto;
  const asunto = `Nuevo testimonio de ${p.autor}`;
  const text = [
    `${p.autor} dejó un testimonio para ${p.estudio}:`,
    "",
    resumen,
    "",
    "Queda pendiente hasta que lo revises: no se publica solo.",
    `Revisalo en ${p.enlace}`,
  ].join("\n");
  const html = [
    `<p><strong>${escapeHtml(p.autor)}</strong> dejó un testimonio para ${escapeHtml(p.estudio)}:</p>`,
    `<blockquote style="margin:0 0 16px;padding-left:12px;border-left:3px solid #e2e8f0;white-space:pre-line">${escapeHtml(resumen)}</blockquote>`,
    "<p>Queda pendiente hasta que lo revises: no se publica solo.</p>",
    `<p><a href="${escapeHtml(p.enlace)}">Revisar testimonios</a></p>`,
  ].join("");
  return { subject: asunto, text, html };
}

function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[testimonios] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

export async function avisarTestimonioNuevo(
  workspaceId: string,
  testimonio: { autorNombre: string; texto: string },
  deps: DepsAvisoTestimonio = {},
): Promise<ResultadoAvisoTestimonio> {
  try {
    if (!(await avisarAlEquipoEncendido(workspaceId))) return "APAGADO";
    const ahora = (deps.ahora ?? (() => new Date()))();
    const hoy = await prisma.fotofficeTestimonio.count({
      where: { workspaceId, origen: { in: ["FORMULARIO", "INVITACION"] }, createdAt: { gte: inicioDelDiaAR(ahora) } },
    });
    if (hoy > TOPE_AVISOS_TESTIMONIO_DIA) return "TOPE";

    const [dueno, workspace] = await Promise.all([
      prisma.workspaceMembership.findFirst({
        where: { workspaceId, role: "WORKSPACE_OWNER" },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      }),
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, fotofficeBranding: { select: { commercialName: true } } } }),
    ]);
    if (!dueno) return "SIN_DESTINATARIO";
    const usuario = await prisma.user.findUnique({ where: { id: dueno.userId }, select: { email: true } });
    const para = usuario?.email?.trim();
    if (!para) return "SIN_DESTINATARIO";

    const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
    const estudio = workspace?.fotofficeBranding?.commercialName?.trim() || workspace?.name || "tu estudio";
    const correo = correoDelAviso({ estudio, autor: testimonio.autorNombre, texto: testimonio.texto, enlace: `${origen}${RUTA_PANEL_TESTIMONIOS}` });
    const enviar = deps.enviar ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    const r = await enviar({ to: para, ...correo });
    if (r.status === "SENT") return "ENVIADO";
    console.warn("[testimonios] el aviso al equipo no salió", { codigo: r.status });
    return "NO_ENVIADO";
  } catch (error) {
    registrarFalla("avisarTestimonioNuevo", error);
    return "ERROR";
  }
}
