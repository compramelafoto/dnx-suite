import "server-only";
import { prisma } from "@repo/db";
import { escapeHtml } from "@/lib/communications/html";
import { sendTransactionalEmail, type OutboundEmail, type SendOutcome } from "@/lib/communications/send-email";
import { correoValido } from "@/lib/plantillas/contexto";
import { inicioDelDiaAR } from "@/lib/plantillas/envio";
import { venceHoyALas2359 } from "@/lib/consultas/aviso";

/**
 * Avisos al equipo de lo que pasa en el enlace público de un presupuesto (spec etapa 2 §2 A.6 y
 * A.9): una tarea para el responsable y, al aceptar, además un correo interno con tope propio.
 *
 * - Destinatario: el responsable del presupuesto si sigue en el equipo; si no, el dueño.
 * - La tarea cuelga de la consulta (y de su recorrido de venta abierto, si hay), como la de
 *   "Responder consulta": se ve en la ficha de la consulta y en Tareas.
 * - El correo sale con el remitente de FOTOFFICE (va a alguien del equipo, no al cliente) y no
 *   se registra como mensaje de la ficha. Tope: `TOPE_AVISOS_ACEPTACION_DIA` aceptaciones por día
 *   de Buenos Aires y organización (se cuentan las aceptaciones: cada una manda como mucho uno).
 *
 * Nunca lanzan y nunca loguean datos personales: sólo códigos.
 */

export const TITULO_TAREA_VISTO = "Presupuesto visto";
export const TITULO_TAREA_ACEPTADO = "Presupuesto aceptado: confirmar el pedido";
export const TITULO_TAREA_PEDIR_NUEVO = "Piden un presupuesto nuevo";
export const TOPE_AVISOS_ACEPTACION_DIA = 50;

export type DepsAvisos = {
  enviar?: (m: OutboundEmail) => Promise<SendOutcome>;
  ahora?: () => Date;
  appOrigin?: string;
};

function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[presupuestos] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/** El responsable si sigue en el equipo; si no, el dueño (el primero). null si no hay nadie. */
export async function destinatarioDelPresupuesto(workspaceId: string, ownerUserId: number | null): Promise<number | null> {
  if (typeof ownerUserId === "number") {
    const m = await prisma.workspaceMembership.findFirst({ where: { workspaceId, userId: ownerUserId }, select: { userId: true } });
    if (m) return m.userId;
  }
  const dueno = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, role: "WORKSPACE_OWNER" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return dueno?.userId ?? null;
}

/**
 * Crea una tarea de la consulta para `para`. Con `unaSolaAbierta`, no la repite si ya hay una
 * igual sin hacer (p. ej. "Piden un presupuesto nuevo" apretado dos veces).
 */
export async function crearTareaDeConsulta(
  workspaceId: string,
  leadId: string,
  titulo: string,
  para: number | null,
  ahora: Date,
  opciones: { unaSolaAbierta?: boolean } = {},
): Promise<"CREADA" | "YA_EXISTIA" | "ERROR"> {
  try {
    if (opciones.unaSolaAbierta) {
      const ya = await prisma.fotofficeTask.findFirst({
        where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, title: titulo, doneAt: null },
        select: { id: true },
      });
      if (ya) return "YA_EXISTIA";
    }
    const recorrido = await prisma.fotofficeJourney.findFirst({
      where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, kind: "VENTA", closedAt: null },
      select: { id: true },
    });
    await prisma.fotofficeTask.create({
      data: {
        workspaceId,
        journeyId: recorrido?.id ?? null,
        stageId: null,
        subjectType: "CAPTACION",
        subjectId: leadId,
        title: titulo,
        dueAt: venceHoyALas2359(ahora),
        required: false,
        assigneeUserId: para,
        createdByUserId: null,
      },
      select: { id: true },
    });
    return "CREADA";
  } catch (error) {
    registrarFalla("crearTareaDeConsulta", error);
    return "ERROR";
  }
}

export type ResultadoAvisoAceptacion = {
  destinatarioUserId: number | null;
  tarea: "CREADA" | "YA_EXISTIA" | "ERROR";
  correo: "ENVIADO" | "NO_ENVIADO" | "TOPE" | "SIN_CORREO" | "SIN_DESTINATARIO" | "ERROR";
};

/** Texto del correo interno (puro). Sin el nombre de quien aceptó: lo ve en FOTOFFICE. */
export function correoDeAceptacion(args: { numero: string | null; total: string; enlaceFicha: string | null }): { asunto: string; texto: string; html: string } {
  const cual = args.numero ? `N° ${args.numero}` : "sin número";
  const asunto = `Aceptaron el presupuesto ${cual}`;
  const lineas = [
    "Hola:",
    "",
    `El cliente aceptó el presupuesto ${cual}, por ${args.total}.`,
    "Quedó como pedido por confirmar. Revisalo y confirmalo desde FOTOFFICE.",
    ...(args.enlaceFicha ? ["", args.enlaceFicha] : []),
  ];
  const html = lineas
    .map((l) => (l === "" ? "<br>" : l === args.enlaceFicha ? `<p><a href="${escapeHtml(l)}">Ver el presupuesto</a></p>` : `<p>${escapeHtml(l)}</p>`))
    .join("");
  return { asunto, texto: lineas.join("\n"), html };
}

/** Tarea + correo interno al aceptar. Nunca lanza. */
export async function avisarAceptacion(
  args: { workspaceId: string; leadId: string; presupuestoId: string; ownerUserId: number | null; numero: string | null; total: string },
  deps: DepsAvisos = {},
): Promise<ResultadoAvisoAceptacion> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const resultado: ResultadoAvisoAceptacion = { destinatarioUserId: null, tarea: "ERROR", correo: "SIN_DESTINATARIO" };
  try {
    resultado.destinatarioUserId = await destinatarioDelPresupuesto(args.workspaceId, args.ownerUserId);
  } catch (error) {
    registrarFalla("destinatarioDelPresupuesto", error);
  }
  resultado.tarea = await crearTareaDeConsulta(args.workspaceId, args.leadId, TITULO_TAREA_ACEPTADO, resultado.destinatarioUserId, ahora);

  const para = resultado.destinatarioUserId;
  if (para === null) return resultado;
  try {
    const hoy = await prisma.fotofficePresupuestoVersion.count({
      where: { workspaceId: args.workspaceId, acceptedAt: { gte: inicioDelDiaAR(ahora) } },
    });
    // La de ahora ya cuenta: la que hace pasar el tope no manda correo.
    if (hoy > TOPE_AVISOS_ACEPTACION_DIA) {
      console.warn("[presupuestos] tope de avisos de aceptación alcanzado", { codigo: "TOPE_AVISOS_ACEPTACION" });
      resultado.correo = "TOPE";
      return resultado;
    }
    const usuario = await prisma.user.findUnique({ where: { id: para }, select: { email: true } });
    if (!correoValido(usuario?.email)) {
      resultado.correo = "SIN_CORREO";
      return resultado;
    }
    const origen = deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
    const correo = correoDeAceptacion({
      numero: args.numero,
      total: args.total,
      enlaceFicha: origen ? `${origen}/presupuestos/${encodeURIComponent(args.presupuestoId)}` : null,
    });
    const enviar = deps.enviar ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    const r = await enviar({ to: usuario!.email!, subject: correo.asunto, html: correo.html, text: correo.texto });
    resultado.correo = r.status === "SENT" ? "ENVIADO" : "NO_ENVIADO";
    if (r.status !== "SENT") console.warn("[presupuestos] el aviso de aceptación no salió", { codigo: r.status });
  } catch (error) {
    resultado.correo = "ERROR";
    registrarFalla("avisarAceptacion", error);
  }
  return resultado;
}
