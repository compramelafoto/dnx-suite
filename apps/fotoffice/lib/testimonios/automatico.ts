import "server-only";
import { prisma } from "@repo/db";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { TOPE_AUTOMATICOS_DIA } from "@/lib/plantillas/constantes";
import { contextoDe, correoValido } from "@/lib/plantillas/contexto";
import { correosEnviadosHoy, enviarCorreo, MENSAJES_ENVIO, type CtxEnvio, type DepsEnvio } from "@/lib/plantillas/envio";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
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
 * - Al cliente no le salió otro pedido de testimonio (de cualquier proyecto, a mano o automático) en
 *   los últimos `DIAS_ENTRE_PEDIDOS_AL_CLIENTE` días: nada de tres pedidos en tres días seguidos.
 * - Como mucho `TOPE_POR_ORGANIZACION` por organización y por día, y un proyecto por cliente por
 *   corrida. Los más viejos primero.
 * - Sólo organizaciones con Sitio web y Clientes encendidos (como el botón «Mensaje»).
 * - El tope diario de automáticos (`TOPE_AUTOMATICOS_DIA`) lo comparten recibos, códigos de contrato,
 *   galerías y respuestas a consultas: los testimonios no pasan de `TOPE_AUTOMATICOS_DIA -
 *   RESERVA_AUTOMATICOS_TRANSACCIONALES` en el día, así siempre queda lugar para esos.
 * - La corrida corta a los `PRESUPUESTO_MS` (la función tiene 300 s) y devuelve lo hecho; empieza por
 *   la organización a la que hace más que no le sale un pedido automático, así ninguna queda siempre al final.
 *
 * Cada pedido crea la invitación con una clave de idempotencia (cliente + proyecto, única en la
 * base: dos corridas a la vez no mandan dos) y sin canal; recién cuando el correo sale se anota el
 * canal. Si no sale, se borra la invitación y se reintenta mañana. Si una corrida murió entre crear
 * la invitación y mandar (fila con clave, sin canal, de hace más de una hora), la siguiente la borra y
 * vuelve a probar. Es un correo AUTOMÁTICO
 * (`enviarCorreo` con `automatico`): cuenta en el tope diario de automáticos de la organización.
 *
 * Nunca lanza por una organización y el registro sólo guarda códigos.
 */

export const TOPE_POR_ORGANIZACION = 30;
export const VENTANA_DIAS = 30;
/** Días sin otro pedido de testimonio (con canal) al mismo cliente. */
export const DIAS_ENTRE_PEDIDOS_AL_CLIENTE = 30;
/** Lugar del tope diario de automáticos que los testimonios nunca usan (recibos, contratos, galerías, consultas). */
export const RESERVA_AUTOMATICOS_TRANSACCIONALES = 30;
/** Tiempo de trabajo de una corrida: cortar antes de los 300 s de la función. */
export const PRESUPUESTO_MS = 240_000;
/** Una invitación con clave y sin canal más vieja que esto quedó colgada (la corrida murió en el medio). */
const COLGADA_MS = 60 * 60 * 1000;
/** Recorridos terminados que se leen por organización (de los más viejos a los más nuevos). */
const LECTURA_MAXIMA = 500;
const DIA_MS = 24 * 60 * 60 * 1000;

export type Candidato = { proyectoId: string; proyectoNombre: string; clientId: string };

export type ReporteAutomatico = {
  /** Organizaciones con el pedido automático (y Sitio web y Clientes) encendido que se revisaron. */
  organizaciones: number;
  enviados: number;
  fallidos: number;
  /** Sin correo válido, o ya reservado por otra corrida. */
  salteados: number;
  /** Organizaciones que llegaron al tope diario de automáticos (o a la parte que les toca a los testimonios). */
  conTopeDiario: number;
  /** La corrida se cortó por tiempo: lo que faltó sale mañana. */
  cortadaPorTiempo: boolean;
};

/** Para las pruebas: el reloj que mide el tiempo de la corrida (en ms). */
export type DepsAutomatico = DepsEnvio & { reloj?: () => number };

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
  // Clientes a los que ya les salió un pedido (de cualquier proyecto) hace poco.
  const clientIds = [...new Set(proyectos.map((p) => p.clientId))];
  const recientes = clientIds.length
    ? await prisma.fotofficeTestimonioInvitacion.findMany({
        where: {
          workspaceId,
          clientId: { in: clientIds },
          canal: { not: null },
          enviadaAt: { gte: new Date(ahora.getTime() - DIAS_ENTRE_PEDIDOS_AL_CLIENTE * DIA_MS) },
        },
        select: { clientId: true },
      })
    : [];
  const pedidosHacePoco = new Set(recientes.map((r) => r.clientId));

  const clientes = new Set<string>();
  const salida: Candidato[] = [];
  for (const id of ids) {
    const p = deId.get(id);
    if (!p || !correoValido(p.client.email)) continue;
    if (yaInvitados.has(`${p.clientId}:${p.id}`) || clientes.has(p.clientId) || pedidosHacePoco.has(p.clientId)) continue;
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

function esClaveRepetida(e: unknown): boolean {
  return codigo(e) === "P2002";
}

/**
 * Si la clave está tomada por una invitación que nunca salió (sin canal) y es de hace más de una hora,
 * quedó colgada (la corrida murió entre crearla y mandar): se borra para poder reintentar. Devuelve si
 * borró algo. Una reserva reciente es de otra corrida en curso: no se toca.
 */
async function liberarClaveColgada(workspaceId: string, clave: string, ahora: Date): Promise<boolean> {
  const colgada = { workspaceId, claveIdempotencia: clave, canal: null, enviadaAt: { lt: new Date(ahora.getTime() - COLGADA_MS) } };
  const fila = await prisma.fotofficeTestimonioInvitacion.findFirst({ where: colgada, select: { id: true } });
  if (!fila) return false;
  const r = await prisma.fotofficeTestimonioInvitacion.deleteMany({ where: { id: fila.id, ...colgada } });
  return r.count > 0;
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
  // Sin el enlace en el cuerpo el pedido no sirve: no se manda (y la organización se corta, como con una plantilla rota).
  if (!textos || !textos.templateId || !textos.cuerpo.includes(MARCA_ENLACE)) {
    // Un automático siempre sale de su plantilla: si no sirve, no tiene sentido seguir con esta organización.
    console.warn("[testimonios] la plantilla del pedido no se pudo armar", { codigo: "PLANTILLA_CON_ERRORES" });
    reporte.fallidos++;
    return "CORTAR";
  }

  // Los testimonios no se comen el lugar de los automáticos transaccionales del día.
  if ((await correosEnviadosHoy(workspaceId, ahora, true)) >= TOPE_AUTOMATICOS_DIA - RESERVA_AUTOMATICOS_TRANSACCIONALES) {
    reporte.conTopeDiario++;
    return "CORTAR";
  }

  const clave = claveDelPedido(c.clientId, c.proyectoId);
  const crear = () =>
    crearInvitacion(workspaceId, {
      clientId: c.clientId,
      proyectoId: c.proyectoId,
      correo,
      nombreSugerido: leido.variables.persona.nombreCompleto,
      detalleSugerido: c.proyectoNombre,
      claveIdempotencia: clave,
      ahora,
    });
  let invitacion: { invitacionId: string; enlace: string };
  try {
    try {
      invitacion = await crear();
    } catch (e) {
      // Clave tomada: si es una invitación colgada de una corrida que murió, se libera y se prueba una vez más.
      if (!esClaveRepetida(e) || !(await liberarClaveColgada(workspaceId, clave, ahora))) throw e;
      invitacion = await crear();
    }
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

/**
 * Las organizaciones en el orden en que se atienden: primero las que nunca recibieron un pedido
 * automático y después la de último envío más viejo. Si no se puede leer, quedan como vinieron.
 */
async function enOrdenDeEspera(ids: string[]): Promise<string[]> {
  if (ids.length < 2) return ids;
  try {
    const ultimos = await prisma.fotofficeTestimonioInvitacion.groupBy({
      by: ["workspaceId"],
      where: { workspaceId: { in: ids }, claveIdempotencia: { startsWith: "auto:" }, canal: { not: null } },
      _max: { enviadaAt: true },
    });
    const ultimo = new Map(ultimos.map((u) => [u.workspaceId, u._max.enviadaAt?.getTime() ?? 0]));
    return [...ids].sort((a, b) => (ultimo.get(a) ?? 0) - (ultimo.get(b) ?? 0));
  } catch (e) {
    console.warn("[testimonios] no se pudo ordenar las organizaciones", { codigo: codigo(e) });
    return ids;
  }
}

/** Sitio web (los testimonios se dejan ahí) y Clientes (el pedido sale desde su ficha) encendidos. */
async function modulosEncendidos(workspaceId: string): Promise<boolean> {
  const [sitio, clientes] = await Promise.all([
    isModuleEnabledForWorkspace(workspaceId, WEBSITE_MODULE_KEY),
    isModuleEnabledForWorkspace(workspaceId, CLIENTS_MODULE_KEY),
  ]);
  return sitio && clientes;
}

/** La corrida diaria. Devuelve sólo contadores (sin datos de nadie). */
export async function enviarPedidosAutomaticos(deps: DepsAutomatico = {}): Promise<ReporteAutomatico> {
  const reporte: ReporteAutomatico = { organizaciones: 0, enviados: 0, fallidos: 0, salteados: 0, conTopeDiario: 0, cortadaPorTiempo: false };
  const ahora = (deps.ahora ?? (() => new Date()))();
  const reloj = deps.reloj ?? (() => Date.now());
  const inicio = reloj();
  const sinTiempo = () => {
    if (reloj() - inicio < PRESUPUESTO_MS) return false;
    reporte.cortadaPorTiempo = true;
    return true;
  };
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
  for (const workspaceId of await enOrdenDeEspera(activos.map((a) => a.workspaceId))) {
    if (sinTiempo()) break;
    try {
      if (!(await modulosEncendidos(workspaceId))) continue;
      reporte.organizaciones++;
      for (const c of await candidatosParaInvitar(workspaceId, ahora)) {
        if (sinTiempo()) break;
        if ((await pedidoDe(workspaceId, c, ahora, reporte, deps)) === "CORTAR") break;
      }
    } catch (e) {
      console.error("[testimonios] falló el pedido automático de una organización", { codigo: codigo(e) });
    }
  }
  return reporte;
}
