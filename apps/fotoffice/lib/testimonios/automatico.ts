import "server-only";
import { prisma } from "@repo/db";
import { contextoDe, correoValido } from "@/lib/plantillas/contexto";
import { enviarCorreo, MENSAJES_ENVIO, type CtxEnvio, type DepsEnvio } from "@/lib/plantillas/envio";
import { leerAjustesTestimonios } from "./ajustes";
import { esTablaFaltante } from "./dominio";
import { crearInvitacion, MENSAJE_SIN_SITIO } from "./invitaciones";
import { MARCA_ENLACE, taparEnlacePersonal, textosDelCorreo } from "./pedido";

/**
 * Pedido automático de testimonios (sitio, PR 3). Lo corre una tarea diaria
 * (`app/api/cron/testimonios-invitaciones`, 14:00 UTC = 11:00 de Buenos Aires). Apagado por omisión:
 * el interruptor es `FotofficeTestimonioAjustes.automaticoEncendido` (no depende de que la plantilla
 * `TESTIMONIO_INVITACION` esté «encendida»).
 *
 * Qué proyecto se invita:
 * - «Finalizado» es un recorrido de TRABAJO cerrado con éxito (`FotofficeJourney` con
 *   `outcome = TERMINADO`): el proyecto no tiene una columna de fecha de finalización, la fecha es el
 *   `closedAt` de ese recorrido (un trabajo reabierto lo pierde y vuelve a contar al terminarse).
 * - Terminó en o después de `encendidoAt` (encender el pedido no le escribe a clientes de hace meses)
 *   y hace al menos `diasDespues` días. Los que terminaron hace más de `diasDespues + VENTANA_DIAS`
 *   ya no se invitan: así los viejos no tapan a los nuevos.
 * - El cliente tiene correo válido (el automático sólo sale por correo) y el proyecto no está suspendido.
 * - No hubo antes una invitación **que haya salido** (con `canal`) para ese cliente y ese proyecto:
 *   un «Pedir testimonio» abierto y cancelado a mano (sin canal) no frena al automático.
 * - Como mucho `TOPE_POR_ORGANIZACION` por organización y por día, y un proyecto por cliente por
 *   corrida (el otro, mañana). Los más viejos primero.
 *
 * Cada pedido crea la invitación con una clave de idempotencia (cliente + proyecto, única en la
 * base: dos corridas a la vez no mandan dos) y sin canal; recién cuando el correo sale se anota el
 * canal. Si no sale, se borra la invitación y se reintenta mañana. Es un correo AUTOMÁTICO
 * (`enviarCorreo` con `automatico`): cuenta en el tope diario de automáticos de la organización.
 *
 * Nunca lanza por una organización y el registro sólo guarda códigos.
 */

export const TOPE_POR_ORGANIZACION = 30;
export const VENTANA_DIAS = 30;
/** Recorridos terminados que se leen por organización (de los más viejos a los más nuevos). */
const LECTURA_MAXIMA = 500;
const DIA_MS = 24 * 60 * 60 * 1000;

export type Candidato = { proyectoId: string; proyectoNombre: string; clientId: string };

export type ReporteAutomatico = {
  /** Organizaciones con el pedido automático encendido que se revisaron. */
  organizaciones: number;
  enviados: number;
  fallidos: number;
  /** Sin correo válido, o ya reservado por otra corrida. */
  salteados: number;
  /** Organizaciones que llegaron al tope diario de automáticos. */
  conTopeDiario: number;
};

function codigo(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "desconocido";
}

function ctxDelSistema(workspaceId: string): CtxEnvio {
  return { workspaceId, userId: null, userLabel: null, userName: null, userEmail: null, role: null };
}

/** La clave que frena el duplicado: una por cliente y proyecto. */
export function claveDelPedido(clientId: string, proyectoId: string): string {
  return `auto:${clientId}:${proyectoId}`;
}

/** Los proyectos a los que hoy les toca el pedido automático (ver arriba). Vacío si está apagado. */
export async function candidatosParaInvitar(workspaceId: string, ahora: Date): Promise<Candidato[]> {
  const ajustes = await leerAjustesTestimonios(workspaceId);
  if (!ajustes.automaticoEncendido || !ajustes.encendidoAt) return [];
  const hasta = new Date(ahora.getTime() - ajustes.diasDespues * DIA_MS);
  const ventana = new Date(hasta.getTime() - VENTANA_DIAS * DIA_MS);
  const desde = ventana.getTime() > ajustes.encendidoAt.getTime() ? ventana : ajustes.encendidoAt;
  if (desde.getTime() > hasta.getTime()) return [];

  const recorridos = await prisma.fotofficeJourney.findMany({
    where: { workspaceId, subjectType: "PROYECTO", outcome: "TERMINADO", closedAt: { gte: desde, lte: hasta } },
    orderBy: [{ closedAt: "asc" }, { id: "asc" }],
    select: { subjectId: true },
    take: LECTURA_MAXIMA,
  });
  if (recorridos.length === 0) return [];
  const ids = [...new Set(recorridos.map((r) => r.subjectId))];

  const [proyectos, previas] = await Promise.all([
    prisma.fotofficeProyecto.findMany({
      where: { workspaceId, id: { in: ids }, suspendedAt: null },
      select: { id: true, name: true, clientId: true, client: { select: { email: true } } },
    }),
    // Sólo cuentan las que salieron (con canal): una abierta y cancelada a mano no frena.
    prisma.fotofficeTestimonioInvitacion.findMany({
      where: { workspaceId, proyectoId: { in: ids }, canal: { not: null } },
      select: { clientId: true, proyectoId: true },
    }),
  ]);
  const yaInvitados = new Set(previas.map((p) => `${p.clientId}:${p.proyectoId}`));
  const deId = new Map(proyectos.map((p) => [p.id, p]));

  const clientes = new Set<string>();
  const salida: Candidato[] = [];
  for (const id of ids) {
    const p = deId.get(id);
    if (!p || !correoValido(p.client.email)) continue;
    if (yaInvitados.has(`${p.clientId}:${p.id}`) || clientes.has(p.clientId)) continue;
    clientes.add(p.clientId);
    salida.push({ proyectoId: p.id, proyectoNombre: p.name, clientId: p.clientId });
    if (salida.length >= TOPE_POR_ORGANIZACION) break;
  }
  return salida;
}

/** Borra la invitación que no llegó a salir para que mañana se reintente. Nunca lanza. */
async function descartarInvitacion(workspaceId: string, id: string): Promise<void> {
  try {
    await prisma.fotofficeTestimonioInvitacion.deleteMany({ where: { id, workspaceId, canal: null } });
  } catch (e) {
    console.error("[testimonios] no se pudo descartar una invitación sin enviar", { codigo: codigo(e) });
  }
}

/** El pedido de un proyecto. "CORTAR": no seguir con esta organización (tope, sin sitio o plantilla rota). */
async function pedidoDe(workspaceId: string, c: Candidato, ahora: Date, reporte: ReporteAutomatico, deps: DepsEnvio): Promise<"SEGUIR" | "CORTAR"> {
  const leido = await contextoDe(workspaceId, "CLIENTE", c.clientId, { nombre: null, email: null }, ahora);
  if (!leido || !correoValido(leido.destino.email)) {
    reporte.salteados++;
    return "SEGUIR";
  }
  const correo = leido.destino.email;
  // Primero los textos (con una marca en lugar del enlace): si no se pueden armar no queda una invitación de más.
  const conMarca = { ...leido, variables: { ...leido.variables, testimonio: { enlace: MARCA_ENLACE } } };
  const textos = await textosDelCorreo(workspaceId, conMarca);
  if (!textos || !textos.templateId) {
    // Un automático siempre sale de su plantilla: si no sirve, no tiene sentido seguir con esta organización.
    console.warn("[testimonios] la plantilla del pedido no se pudo armar", { codigo: "PLANTILLA_CON_ERRORES" });
    reporte.fallidos++;
    return "CORTAR";
  }

  let invitacion: { invitacionId: string; enlace: string };
  try {
    invitacion = await crearInvitacion(workspaceId, {
      clientId: c.clientId,
      proyectoId: c.proyectoId,
      correo,
      nombreSugerido: leido.variables.persona.nombreCompleto,
      detalleSugerido: c.proyectoNombre,
      claveIdempotencia: claveDelPedido(c.clientId, c.proyectoId),
      ahora,
    });
  } catch (e) {
    if ((e as { message?: unknown })?.message === MENSAJE_SIN_SITIO) {
      console.warn("[testimonios] pedido automático sin dirección pública", { codigo: "SIN_SITIO" });
      reporte.fallidos++;
      return "CORTAR";
    }
    // Lo más probable: otra corrida ya reservó este (cliente, proyecto) (clave única).
    console.warn("[testimonios] no se pudo crear la invitación automática", { codigo: codigo(e) });
    reporte.salteados++;
    return "SEGUIR";
  }

  const conEnlace = (t: string) => t.split(MARCA_ENLACE).join(invitacion.enlace);
  let r: Awaited<ReturnType<typeof enviarCorreo>>;
  try {
    r = await enviarCorreo(
      ctxDelSistema(workspaceId),
      {
        entityType: "CLIENTE", entityId: c.clientId, templateId: textos.templateId, asunto: conEnlace(textos.asunto), cuerpo: conEnlace(textos.cuerpo),
        automatico: true,
      },
      { enviar: deps.enviar, ahora: () => ahora },
      // El enlace personal queda tapado en el historial, como en el pedido a mano.
      { tipoPlantilla: "TESTIMONIO", taparEnRegistro: taparEnlacePersonal },
    );
  } catch (e) {
    await descartarInvitacion(workspaceId, invitacion.invitacionId);
    throw e;
  }
  if (r.ok) {
    try {
      await prisma.fotofficeTestimonioInvitacion.updateMany({ where: { id: invitacion.invitacionId, workspaceId }, data: { canal: "EMAIL" } });
    } catch (e) {
      // Ya salió; si no se anota el canal, la clave única igual impide repetirlo.
      console.error("[testimonios] no se pudo anotar el canal de la invitación", { codigo: codigo(e) });
    }
    reporte.enviados++;
    return "SEGUIR";
  }
  // No salió: se descarta la invitación (queda libre la clave) y se reintenta mañana.
  await descartarInvitacion(workspaceId, invitacion.invitacionId);
  if (r.error === MENSAJES_ENVIO.topeAutomaticos) {
    reporte.conTopeDiario++;
    return "CORTAR";
  }
  reporte.fallidos++;
  return "SEGUIR";
}

/** La corrida diaria. Devuelve sólo contadores (sin datos de nadie). */
export async function enviarPedidosAutomaticos(deps: DepsEnvio = {}): Promise<ReporteAutomatico> {
  const reporte: ReporteAutomatico = { organizaciones: 0, enviados: 0, fallidos: 0, salteados: 0, conTopeDiario: 0 };
  const ahora = (deps.ahora ?? (() => new Date()))();
  let activos: { workspaceId: string }[];
  try {
    activos = await prisma.fotofficeTestimonioAjustes.findMany({
      where: { automaticoEncendido: true },
      select: { workspaceId: true },
      orderBy: [{ workspaceId: "asc" }],
      take: 1000,
    });
  } catch (e) {
    // Sin las tablas todavía (migración sin aplicar): no hay nada que hacer.
    if (esTablaFaltante(e)) return reporte;
    throw e;
  }
  for (const a of activos) {
    reporte.organizaciones++;
    try {
      for (const c of await candidatosParaInvitar(a.workspaceId, ahora)) {
        if ((await pedidoDe(a.workspaceId, c, ahora, reporte, deps)) === "CORTAR") break;
      }
    } catch (e) {
      console.error("[testimonios] falló el pedido automático de una organización", { codigo: codigo(e) });
    }
  }
  return reporte;
}
