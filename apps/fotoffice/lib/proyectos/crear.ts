import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { iniciarEnTransaccion } from "@/lib/circuitos/recorridos";
import type { CtxCircuitos } from "@/lib/circuitos/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { asignarNumero } from "@/lib/numeracion/asignar";
import { OPCIONES_TRANSACCION_PEDIDO } from "@/lib/pedidos/constantes";
import { bloquearPedido, fechaParaBase } from "@/lib/pedidos/plan";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { itemsGuardados } from "@/lib/presupuestos/versiones";
import { MENSAJES_PROYECTO, PROJECTS_MODULE_KEY, puedeGestionarProyectos, type CtxProyectos } from "./acceso";
import { LARGO_MAXIMO_NOMBRE, PROFUNDIDAD_MAXIMA_COMBOS } from "./constantes";
import { fechaBase, planDeEtapas, sumarDias } from "./fechas";
import { aplicarPlantillaNombre } from "./nombre";
import { proyectosDelPedido, type ProyectoDesdeRegla } from "./reglas";

/**
 * Creación de proyectos (Etapa 4, Entrega A).
 *
 * - **Al confirmar un pedido** (y al darlo de alta a mano), dentro de la MISMA transacción:
 *   `crearProyectosDelPedido` lee las reglas "Proyecto que genera" de los productos del pedido y de
 *   los componentes de sus combos (`proyectosDelPedido`) y crea un proyecto por regla, salvo los que
 *   la persona destildó en la vista previa. Sólo si el módulo Proyectos está encendido.
 * - **A mano** desde la ficha del pedido: `crearProyectoManual`, con flujo y nombre a elección y sin
 *   ítem (`pedidoItemIndex` nulo).
 *
 * Cada proyecto lleva su número `PROYECTO`, sus fechas (`baseDate` = día del evento o, sin evento, el
 * de la confirmación; plan por etapa acumulado) y su recorrido abierto en la primera etapa del flujo,
 * con el responsable de la regla o, si no tiene, el del pedido.
 *
 * Un flujo archivado, que no es de trabajo o sin etapas se saltea y la vista previa lo avisa.
 * Es idempotente: antes de insertar se mira el único (pedido, ítem, flujo) en la misma transacción
 * (en Postgres un choque de único aborta la transacción entera, no se puede capturar adentro).
 */

type Tx = Prisma.TransactionClient;
type Lector = Pick<
  Tx,
  "fotofficeProductoProyecto" | "fotofficeComboItem" | "fotofficeCircuit" | "fotofficeStage" | "product" | "client" | "workspaceMembership"
>;

export type EtapaDelFlujo = { id: string; days: number };

export type ProyectoPlanificado = {
  /** Posición en la lista: lo que se tilda en la vista previa y viaja como `proyectosOmitidos`. */
  index: number;
  regla: ProyectoDesdeRegla;
  nombre: string;
  flujo: string;
  etapas: EtapaDelFlujo[];
  /** "aaaa-mm-dd". */
  baseDate: string;
  finalDueDate: string;
  ownerUserId: number | null;
  /** Si está, el proyecto NO se crea y la vista previa muestra este motivo. */
  aviso: string | null;
};

export type DatosPlanificacion = {
  clientId: string;
  /** Los ítems guardados del pedido (`items` de la instantánea). */
  items: unknown;
  /** "aaaa-mm-dd" o el `Date` de la columna `eventDate`; null sin evento. */
  fechaEvento: string | Date | null;
  eventLabel: string | null;
  /** null en la vista previa (el número aún no existe). */
  numeroPedido: string | null;
  /** Responsable del pedido, para las reglas sin responsable propio. */
  ownerUserId: number | null;
  confirmadoEn: Date;
};

function fechaCorta(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

/** Lo que se va a crear, sin escribir nada. El orden es estable: lo usan la vista previa y la creación. */
export async function planificarProyectos(cliente: Lector, workspaceId: string, d: DatosPlanificacion): Promise<ProyectoPlanificado[]> {
  const items = itemsGuardados(d.items).map((i) => ({ productId: i.productId, cantidad: i.cantidad, opcional: i.opcional }));
  const raiz = [...new Set(items.filter((i) => !i.opcional && typeof i.productId === "string" && i.productId).map((i) => i.productId as string))];
  if (raiz.length === 0) return [];

  // Los componentes de los combos, nivel por nivel (un combo puede tener otro combo adentro).
  const vistos = new Set(raiz);
  const combos: { comboProductId: string; componentProductId: string; quantity: number }[] = [];
  let frontera = raiz;
  for (let nivel = 0; nivel < PROFUNDIDAD_MAXIMA_COMBOS && frontera.length > 0; nivel++) {
    const filas = await cliente.fotofficeComboItem.findMany({
      where: { workspaceId, comboProductId: { in: frontera } },
      orderBy: [{ order: "asc" }],
      select: { comboProductId: true, componentProductId: true, quantity: true },
    });
    combos.push(...filas);
    frontera = [...new Set(filas.map((f) => f.componentProductId).filter((id) => !vistos.has(id)))];
    for (const id of frontera) vistos.add(id);
  }

  const reglas = await cliente.fotofficeProductoProyecto.findMany({
    where: { workspaceId, productId: { in: [...vistos] } },
    orderBy: [{ order: "asc" }],
    select: { productId: true, circuitId: true, ownerUserId: true, daysFromEvent: true, nameTemplate: true },
  });
  if (reglas.length === 0) return [];

  const desdeReglas = proyectosDelPedido(items, reglas, combos);
  if (desdeReglas.length === 0) return [];

  const circuitIds = [...new Set(desdeReglas.map((p) => p.circuitId))];
  const productIds = [...new Set(desdeReglas.map((p) => p.productId))];
  const duenos = [...new Set([...desdeReglas.map((p) => p.ownerUserId), d.ownerUserId].filter((x): x is number => x !== null))];
  const [circuitos, etapas, productos, contacto, miembros] = await Promise.all([
    cliente.fotofficeCircuit.findMany({ where: { workspaceId, id: { in: circuitIds } }, select: { id: true, name: true, kind: true, isActive: true } }),
    cliente.fotofficeStage.findMany({
      where: { circuit: { workspaceId }, circuitId: { in: circuitIds }, archivedAt: null },
      orderBy: [{ order: "asc" }],
      select: { id: true, circuitId: true, days: true },
    }),
    cliente.product.findMany({ where: { workspaceId, id: { in: productIds } }, select: { id: true, name: true } }),
    cliente.client.findFirst({ where: { id: d.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } }),
    duenos.length ? cliente.workspaceMembership.findMany({ where: { workspaceId, userId: { in: duenos } }, select: { userId: true } }) : Promise.resolve([]),
  ]);
  const circuitoPorId = new Map(circuitos.map((c) => [c.id, c]));
  const nombreProducto = new Map(productos.map((p) => [p.id, p.name]));
  const equipo = new Set(miembros.map((m) => m.userId));
  const base = fechaBase(d.fechaEvento, d.confirmadoEn);
  const nombreContacto = nombreDeContacto(contacto);
  const evento = d.fechaEvento ? fechaCorta(fechaBase(d.fechaEvento, d.confirmadoEn)) : d.eventLabel;

  return desdeReglas.map((regla, index) => {
    const c = circuitoPorId.get(regla.circuitId);
    const etapasDelFlujo = etapas.filter((e) => e.circuitId === regla.circuitId).map((e) => ({ id: e.id, days: e.days }));
    const flujo = c?.name ?? "Flujo";
    let aviso: string | null = null;
    if (!c || c.kind !== "TRABAJO") aviso = `El flujo «${flujo}» ya no existe: no se crea este proyecto.`;
    else if (!c.isActive) aviso = `El flujo «${flujo}» está archivado: no se crea este proyecto.`;
    else if (etapasDelFlujo.length === 0) aviso = `El flujo «${flujo}» no tiene etapas: no se crea este proyecto.`;
    const dueno = regla.ownerUserId !== null && equipo.has(regla.ownerUserId) ? regla.ownerUserId : d.ownerUserId !== null && equipo.has(d.ownerUserId) ? d.ownerUserId : null;
    return {
      index,
      regla,
      nombre: aplicarPlantillaNombre(regla.nameTemplate, {
        contacto: nombreContacto,
        producto: nombreProducto.get(regla.productId) ?? "",
        evento,
        pedido: d.numeroPedido,
      }),
      flujo,
      etapas: etapasDelFlujo,
      baseDate: base,
      finalDueDate: sumarDias(base, regla.daysFromEvent),
      ownerUserId: dueno,
      aviso,
    };
  });
}

/** Lo que muestra la vista previa de "Confirmar pedido". */
export type ProyectoVistaPrevia = { index: number; nombre: string; flujo: string; finalDueDate: string; aviso?: string };

export function aVistaPrevia(planificados: readonly ProyectoPlanificado[]): ProyectoVistaPrevia[] {
  return planificados.map((p) => ({
    index: p.index,
    nombre: p.nombre,
    flujo: p.flujo,
    finalDueDate: p.finalDueDate,
    ...(p.aviso ? { aviso: p.aviso } : {}),
  }));
}

/** ¿El módulo Proyectos está encendido? Sin él, ni la vista previa ni la creación hacen nada. */
export function proyectosEncendidos(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, PROJECTS_MODULE_KEY);
}

type DatosProyecto = {
  workspaceId: string;
  clientId: string;
  pedidoId: string | null;
  pedidoItemIndex: number | null;
  productId: string | null;
  circuitId: string;
  nombre: string;
  eventDate: string | null;
  baseDate: string;
  finalDueDate: string | null;
  ownerUserId: number | null;
  etapas: readonly EtapaDelFlujo[];
  createdByUserId: number | null;
  ahora: Date;
};

/** Proyecto + número + plan + recorrido en la primera etapa, en la transacción de quien llama. */
async function insertarProyecto(tx: Tx, ctx: CtxCircuitos, d: DatosProyecto): Promise<{ id: string; numero: string }> {
  const id = randomUUID();
  const numero = await asignarNumero(tx, { workspaceId: d.workspaceId, key: "PROYECTO", entityType: "PROYECTO", entityId: id, fecha: d.ahora });
  await tx.fotofficeProyecto.create({
    data: {
      id,
      workspaceId: d.workspaceId,
      number: numero.display,
      name: d.nombre.slice(0, LARGO_MAXIMO_NOMBRE),
      clientId: d.clientId,
      pedidoId: d.pedidoId,
      pedidoItemIndex: d.pedidoItemIndex,
      productId: d.productId,
      circuitId: d.circuitId,
      eventDate: d.eventDate ? fechaParaBase(d.eventDate) : null,
      baseDate: fechaParaBase(d.baseDate),
      finalDueDate: d.finalDueDate ? fechaParaBase(d.finalDueDate) : null,
      ownerUserId: d.ownerUserId,
      createdByUserId: d.createdByUserId,
    },
    select: { id: true },
  });
  // El plan va ANTES de abrir el recorrido: las tareas de la primera etapa vencen según él.
  await tx.fotofficeProyectoEtapaPlan.createMany({
    data: planDeEtapas(d.etapas, d.baseDate).map((p) => ({
      workspaceId: d.workspaceId,
      proyectoId: id,
      stageId: p.stageId,
      plannedDueDate: fechaParaBase(p.plannedDueDate),
    })),
  });
  const { journeyId } = await iniciarEnTransaccion(tx, ctx, { tipo: "PROYECTO", id }, d.circuitId);
  if (d.ownerUserId !== null) {
    await tx.fotofficeJourney.update({ where: { id: journeyId }, data: { ownerUserId: d.ownerUserId } });
  }
  return { id, numero: numero.display };
}

function diaDeEvento(f: string | Date | null): string | null {
  return f === null ? null : typeof f === "string" ? f : f.toISOString().slice(0, 10);
}

export type DatosCrearDelPedido = DatosPlanificacion & {
  pedidoId: string;
  /** Posiciones (de la lista de `planificarProyectos`) que la persona destildó. */
  omitidos?: ReadonlySet<number>;
};

export type ResultadoCrearDelPedido = { creados: number; salteados: string[] };

/** Un índice destildado que no corresponde a ningún proyecto de la lista. */
export class IndiceInvalido extends Error {
  constructor() {
    super("indice");
  }
}

/**
 * Crea los proyectos del pedido que acaba de insertarse. Lanza `IndiceInvalido` si `omitidos` trae una posición que no existe. No lanza por flujos inservibles (los saltea
 * y los devuelve en `salteados`); un error de la base sí corta la transacción entera.
 */
export async function crearProyectosDelPedido(tx: Tx, ctx: CtxCircuitos, d: DatosCrearDelPedido): Promise<ResultadoCrearDelPedido> {
  const { workspaceId } = ctx;
  const planificados = await planificarProyectos(tx, workspaceId, d);
  for (const i of d.omitidos ?? []) if (!Number.isInteger(i) || i < 0 || i >= planificados.length) throw new IndiceInvalido();
  let creados = 0;
  const salteados: string[] = [];
  for (const p of planificados) {
    if (d.omitidos?.has(p.index)) continue;
    if (p.aviso) {
      salteados.push(p.aviso);
      continue;
    }
    const ya = await tx.fotofficeProyecto.findFirst({
      where: { pedidoId: d.pedidoId, pedidoItemIndex: p.regla.pedidoItemIndex, circuitId: p.regla.circuitId },
      select: { id: true },
    });
    if (ya) continue;
    await insertarProyecto(tx, ctx, {
      workspaceId,
      clientId: d.clientId,
      pedidoId: d.pedidoId,
      pedidoItemIndex: p.regla.pedidoItemIndex,
      productId: p.regla.productId,
      circuitId: p.regla.circuitId,
      nombre: p.nombre,
      eventDate: diaDeEvento(d.fechaEvento),
      baseDate: p.baseDate,
      finalDueDate: p.finalDueDate,
      ownerUserId: p.ownerUserId,
      etapas: p.etapas,
      createdByUserId: ctx.userId,
      ahora: d.confirmadoEn,
    });
    creados++;
  }
  return { creados, salteados };
}

// --- "Agregar proyecto" desde la ficha del pedido -------------------------------------------------

export type DatosProyectoManual = {
  pedidoId: unknown;
  circuitId: unknown;
  /** Vacío = «{contacto}» con el nombre del contacto. */
  nombre?: unknown;
  ownerUserId?: unknown;
};

export type ResultadoProyectoManual = { ok: true; proyectoId: string; numero: string } | { ok: false; error: string };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

class Corte extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

/**
 * Agrega a mano un proyecto a un pedido: flujo a elección y nombre, sin ítem (`pedidoItemIndex`
 * nulo, así que no choca con el único). Pide "Gestionar" en Proyectos y el módulo encendido.
 * Se puede agregar a un pedido en cualquier estado menos cancelado.
 */
export async function crearProyectoManual(ctx: CtxProyectos, datos: DatosProyectoManual, deps: { ahora?: () => Date } = {}): Promise<ResultadoProyectoManual> {
  if (!puedeGestionarProyectos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!datos || typeof datos !== "object" || !idValido(datos.pedidoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  if (!idValido(datos.circuitId)) return { ok: false, error: MENSAJES_PROYECTO.flujo };
  let nombre = "";
  if (datos.nombre !== undefined && datos.nombre !== null) {
    if (typeof datos.nombre !== "string") return { ok: false, error: MENSAJES_PROYECTO.nombre };
    nombre = datos.nombre.trim().replace(/\s+/g, " ");
    if (nombre.length > LARGO_MAXIMO_NOMBRE) return { ok: false, error: MENSAJES_PROYECTO.nombre };
  }
  let dueno: number | null = null;
  if (datos.ownerUserId !== undefined && datos.ownerUserId !== null && datos.ownerUserId !== "") {
    if (typeof datos.ownerUserId !== "number" || !Number.isInteger(datos.ownerUserId) || datos.ownerUserId <= 0) return { ok: false, error: MENSAJES_PROYECTO.responsable };
    dueno = datos.ownerUserId;
  }
  const { workspaceId } = ctx;
  const pedidoId = datos.pedidoId;
  const circuitId = datos.circuitId;
  const ahora = deps.ahora?.() ?? new Date();

  try {
    if (!(await proyectosEncendidos(workspaceId))) return { ok: false, error: MENSAJES_PROYECTO.moduloApagado };
    return await prisma.$transaction(async (tx): Promise<ResultadoProyectoManual> => {
      await bloquearPedido(tx, pedidoId);
      const pedido = await tx.fotofficePedido.findFirst({
        where: { id: pedidoId, workspaceId },
        select: { id: true, number: true, status: true, clientId: true, eventDate: true, eventLabel: true, ownerUserId: true },
      });
      if (!pedido) throw new Corte(MENSAJES_PROYECTO.pedido);
      if (pedido.status === "CANCELADO") throw new Corte(MENSAJES_PROYECTO.pedidoCancelado);
      const circuito = await tx.fotofficeCircuit.findFirst({
        where: { id: circuitId, workspaceId, kind: "TRABAJO", isActive: true },
        select: { id: true, name: true },
      });
      if (!circuito) throw new Corte(MENSAJES_PROYECTO.flujo);
      const etapas = await tx.fotofficeStage.findMany({
        where: { circuitId: circuito.id, circuit: { workspaceId }, archivedAt: null },
        orderBy: [{ order: "asc" }],
        select: { id: true, days: true },
      });
      if (etapas.length === 0) throw new Corte(MENSAJES_PROYECTO.flujoSinEtapas);

      const candidatos = [dueno, pedido.ownerUserId].filter((x): x is number => x !== null);
      const miembros = candidatos.length
        ? new Set((await tx.workspaceMembership.findMany({ where: { workspaceId, userId: { in: candidatos } }, select: { userId: true } })).map((m) => m.userId))
        : new Set<number>();
      if (dueno !== null && !miembros.has(dueno)) throw new Corte(MENSAJES_PROYECTO.responsable);
      const responsable = dueno ?? (pedido.ownerUserId !== null && miembros.has(pedido.ownerUserId) ? pedido.ownerUserId : null);

      const contacto = await tx.client.findFirst({ where: { id: pedido.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } });
      const evento = diaDeEvento(pedido.eventDate);
      const base = fechaBase(pedido.eventDate, ahora);
      const r = await insertarProyecto(tx, ctx, {
        workspaceId,
        clientId: pedido.clientId,
        pedidoId: pedido.id,
        pedidoItemIndex: null,
        productId: null,
        circuitId: circuito.id,
        nombre: nombre || aplicarPlantillaNombre("{contacto}", { contacto: nombreDeContacto(contacto), pedido: pedido.number }),
        eventDate: evento,
        baseDate: base,
        finalDueDate: null,
        ownerUserId: responsable,
        etapas,
        createdByUserId: ctx.userId,
        ahora,
      });
      return { ok: true, proyectoId: r.id, numero: r.numero };
    }, OPCIONES_TRANSACCION_PEDIDO);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    const codigo = (e as { code?: unknown } | null)?.code;
    console.error("[proyectos] crearProyectoManual falló", { codigo: typeof codigo === "string" ? codigo : null });
    return { ok: false, error: MENSAJES_PROYECTO.fallo };
  }
}
