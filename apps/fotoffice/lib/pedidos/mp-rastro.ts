import "server-only";
import { after } from "next/server";
import { prisma } from "@repo/db";
import { escapeHtml } from "@/lib/communications/html";
import { sendTransactionalEmail, type OutboundEmail, type SendOutcome } from "@/lib/communications/send-email";
import { sanitizeError } from "@/lib/payments/connect/log";
import { correoValido } from "@/lib/plantillas/contexto";
import { inicioDelDiaAR } from "@/lib/plantillas/envio";
import { crearTareaDeConsulta, destinatarioDelPresupuesto } from "@/lib/presupuestos/avisos";

/**
 * El rastro de un pago de Mercado Pago que necesita a una persona (revisión B2-1, B2-2 y B2-4): un pago
 * aprobado que no se pudo aplicar, uno de una cuota que ya no existe, o uno ya acreditado que Mercado Pago
 * devolvió o le reclamaron. **Nunca se pierde en silencio**:
 *
 * 1. Una tarea en el checklist del pedido (`FotofficePedidoTarea`): queda en la ficha aunque el pedido no
 *    tenga consulta. Su texto es determinístico (pago + qué pasó), así el mismo aviso repetido no la duplica.
 * 2. Si el pedido tiene consulta, además la tarea de la consulta (se ve en Tareas, con responsable).
 * 3. Un correo interno al responsable del pedido (o al dueño), después de responder (`after()`), con tope
 *    diario por organización. Sólo sale cuando la tarea es nueva (o cuando no hay pedido donde dejarla).
 *
 * No toca Caja ni los cobros: lo decide una persona. Nunca lanza ni loguea datos personales.
 */

/** Tope de correos internos de Mercado Pago por organización y día de Buenos Aires. */
export const TOPE_AVISOS_MP_DIA = 50;
/** Todas las tareas del rastro empiezan así: sirve para contar el tope del día. */
const MARCA = "Mercado Pago";

export type DepsRastro = {
  /** Para las pruebas: ejecuta el correo (por omisión, `after()` de Next). */
  luego?: (tarea: () => Promise<unknown>) => void;
  enviar?: (m: OutboundEmail) => Promise<SendOutcome>;
  ahora?: () => Date;
  appOrigin?: string;
};

export type RastroDePago = {
  /** null si no se pudo saber de qué pedido es (referencia vieja de una cuota borrada). */
  pedidoId: string | null;
  /** El texto de la tarea del pedido (y del correo). */
  titulo: string;
  /** La tarea de la consulta, si el pedido tiene; null = no dejarla. */
  tituloConsulta: string | null;
  asunto: string;
};

export type ResultadoRastro = {
  tarea: "CREADA" | "YA_EXISTIA" | "SIN_PEDIDO" | "ERROR";
  correo: "PROGRAMADO" | "NO";
};

function programar(tarea: () => Promise<unknown>, deps: DepsRastro): void {
  const segura = () => tarea().catch(() => undefined);
  if (deps.luego) return deps.luego(segura);
  try {
    after(segura);
  } catch {
    void segura();
  }
}

/** Agrega la tarea al checklist del pedido si no hay una con el mismo texto. Con candado: dos avisos a la vez ven la misma. */
async function tareaEnElPedido(workspaceId: string, pedidoId: string, titulo: string, ahora: Date): Promise<"CREADA" | "YA_EXISTIA"> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-rastro-mp:${pedidoId}:${titulo}`}))`;
    const ya = await tx.fotofficePedidoTarea.findFirst({ where: { workspaceId, pedidoId, title: titulo }, select: { id: true } });
    if (ya) return "YA_EXISTIA" as const;
    const ultima = await tx.fotofficePedidoTarea.findFirst({ where: { workspaceId, pedidoId }, orderBy: { position: "desc" }, select: { position: true } });
    await tx.fotofficePedidoTarea.create({
      data: { workspaceId, pedidoId, position: (ultima?.position ?? 0) + 1, title: titulo, createdAt: ahora },
      select: { id: true },
    });
    return "CREADA" as const;
  });
}

export async function dejarRastroDePago(workspaceId: string, r: RastroDePago, deps: DepsRastro = {}): Promise<ResultadoRastro> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const salida: ResultadoRastro = { tarea: "SIN_PEDIDO", correo: "NO" };
  let pedido: { id: string; number: string; consultaLeadId: string | null; ownerUserId: number | null } | null = null;
  try {
    if (r.pedidoId) {
      pedido = await prisma.fotofficePedido.findFirst({
        where: { id: r.pedidoId, workspaceId },
        select: { id: true, number: true, consultaLeadId: true, ownerUserId: true },
      });
    }
    if (pedido) salida.tarea = await tareaEnElPedido(workspaceId, pedido.id, r.titulo, ahora);
  } catch (error) {
    salida.tarea = "ERROR";
    console.error("[fotoffice][pedidos] no se pudo dejar la tarea del pago en el pedido", { detalle: sanitizeError(error) });
  }
  // Ya avisado (el mismo aviso de Mercado Pago repetido): no se manda otro correo.
  if (salida.tarea === "YA_EXISTIA") return salida;

  console.warn("[fotoffice][pedidos] pago de Mercado Pago que necesita a una persona", { tarea: salida.tarea });
  let para: number | null = null;
  try {
    para = await destinatarioDelPresupuesto(workspaceId, pedido?.ownerUserId ?? null);
  } catch (error) {
    console.error("[fotoffice][pedidos] no se pudo elegir a quién avisar", { detalle: sanitizeError(error) });
  }
  if (pedido?.consultaLeadId && r.tituloConsulta) {
    await crearTareaDeConsulta(workspaceId, pedido.consultaLeadId, r.tituloConsulta, para, ahora, { unaSolaAbierta: true });
  }

  const p = pedido;
  programar(() => correoInterno(workspaceId, p, para, r, ahora, deps), deps);
  salida.correo = "PROGRAMADO";
  return salida;
}

async function correoInterno(
  workspaceId: string,
  pedido: { id: string; number: string } | null,
  para: number | null,
  r: RastroDePago,
  ahora: Date,
  deps: DepsRastro,
): Promise<"ENVIADO" | "NO_ENVIADO" | "TOPE" | "SIN_DESTINATARIO" | "SIN_CORREO" | "ERROR"> {
  try {
    if (para === null) return "SIN_DESTINATARIO";
    // La tarea de este aviso ya cuenta: la que hace pasar el tope no manda correo.
    const hoy = await prisma.fotofficePedidoTarea.count({
      where: { workspaceId, title: { contains: MARCA }, createdAt: { gte: inicioDelDiaAR(ahora) } },
    });
    if (hoy > TOPE_AVISOS_MP_DIA) {
      console.warn("[fotoffice][pedidos] tope de avisos de Mercado Pago alcanzado", { codigo: "TOPE_AVISOS_MP" });
      return "TOPE";
    }
    const usuario = await prisma.user.findUnique({ where: { id: para }, select: { email: true } });
    if (!correoValido(usuario?.email)) return "SIN_CORREO";
    const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
    const enlace = pedido && origen ? `${origen}/pedidos/${encodeURIComponent(pedido.id)}` : null;
    const lineas = [
      "Hola:",
      "",
      r.titulo,
      pedido ? `Es del pedido N° ${pedido.number}.` : "No pudimos saber de qué pedido es: buscalo por el número de pago en tu cuenta de Mercado Pago.",
      "No tocamos Caja ni los cobros: lo tiene que resolver una persona.",
    ];
    const html =
      lineas.map((l) => (l === "" ? "<br>" : `<p>${escapeHtml(l)}</p>`)).join("") +
      (enlace ? `<p><a href="${escapeHtml(enlace)}">Ver el pedido</a></p>` : "");
    const texto = [...lineas, ...(enlace ? ["", enlace] : [])].join("\n");
    const enviar = deps.enviar ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    const res = await enviar({ to: usuario!.email!, subject: r.asunto, html, text: texto });
    if (res.status !== "SENT") console.warn("[fotoffice][pedidos] el aviso de Mercado Pago no salió", { codigo: res.status });
    return res.status === "SENT" ? "ENVIADO" : "NO_ENVIADO";
  } catch (error) {
    console.error("[fotoffice][pedidos] falló el aviso interno de Mercado Pago", { detalle: sanitizeError(error) });
    return "ERROR";
  }
}
