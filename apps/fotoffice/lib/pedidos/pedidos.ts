import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { asignarNumero } from "@/lib/numeracion/asignar";
import { validarDescuento, validarItems, type ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { calcularTotales } from "@/lib/presupuestos/totales";
import { itemParaEquipo, itemsGuardados, type ItemEquipo, type TotalesGuardados } from "@/lib/presupuestos/versiones";
import { agendaEncendida, crearCitasDelPedido } from "@/lib/agenda/crear";
import { crearProyectosDelPedido, proyectosEncendidos } from "@/lib/proyectos/crear";
import { nombreDeContacto } from "./nombre-contacto";
import { MENSAJES_PEDIDO, puedeGestionarPedidos, puedeVerPedidos, veCostosDePedido, type CtxPedidos } from "./acceso";
import { rubroIngresoPorOmision } from "./ajustes";
import {
  ENTIDAD_NUMERACION_PEDIDO,
  esEstadoPedido,
  ID_OPCION_CONTADO,
  OPCIONES_TRANSACCION_PEDIDO,
  type EstadoPedido,
} from "./constantes";
import { copiarTareasAlPedido, titulosParaPedidoNuevo } from "./checklist";
import { crearCuentasDelPedido } from "./cuentas-pagar";
import { puedePasarPedido, resumenDePlan, type ResumenPlan } from "./estado";
import type { OpcionPago } from "./opciones-pago";
import {
  bloquearPedido,
  crearCuotas,
  fechaDeBase,
  fechaParaBase,
  leerCuotasEditadas,
  pesosDeBase,
  pesosParaBase,
  planesDe,
  type CuotaParaGuardar,
} from "./plan";
import { esFechaValida, planDesdeOpcion, repartirImporte, validarPlan, type AvisoPlan } from "./plan-cuotas";

/**
 * Pedidos (spec §2 A.2): alta manual desde un contacto, estados, rubro y lecturas. La
 * confirmación desde un presupuesto aceptado está en `./confirmar.ts` y usa `insertarPedido`.
 *
 * Reglas comunes:
 * - el `workspaceId` sale del contexto (la sesión); cada id que llega se busca DENTRO del
 *   workspace y, si no está, "no existe";
 * - los cambios de estado pasan por `puedePasarPedido` y se escriben condicionales (`status` = el
 *   leído), con el candado del pedido;
 * - margen y costos (el cálculo de cada ítem) sólo con `veCostosDePedido`.
 *
 * Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;

export type Resultado = { ok: true } | { ok: false; error: string };

export type DepsPedidos = { ahora?: () => Date };

export const MAX_ETIQUETA_EVENTO = 200;
export const MAX_MOTIVO_CANCELACION = 1000;

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function falla(donde: string, error: unknown): void {
  // Sólo el código del error: ni ids, ni mensajes (pueden traer datos personales).
  const e = error as { code?: unknown } | null;
  console.error(`[pedidos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

export { nombreDeContacto };

// --- Piezas comunes con la confirmación ---------------------------------------------------------

type LectorRubro = Pick<Tx, "fotofficeProductoCatalogo" | "cashCategory" | "fotofficePedidoAjustes">;

/**
 * Rubro de ingreso del pedido: el del primer ítem de catálogo (en el orden de los ítems) cuyo
 * producto tenga `incomeCategoryId`, si ese rubro sigue siendo un INGRESO del workspace. Si
 * ninguno tiene, el rubro por omisión de Configuración → Pedidos (Entrega B1), si sigue siendo un
 * INGRESO del workspace. null si no hay ninguno.
 */
export async function rubroDeItems(cliente: LectorRubro, workspaceId: string, items: readonly Pick<ItemPresupuesto, "productId">[]): Promise<string | null> {
  return (await rubroDeLosProductos(cliente, workspaceId, items)) ?? (await rubroIngresoPorOmision(cliente, workspaceId));
}

async function rubroDeLosProductos(cliente: LectorRubro, workspaceId: string, items: readonly Pick<ItemPresupuesto, "productId">[]): Promise<string | null> {
  const productIds = [...new Set(items.map((i) => i.productId).filter((x): x is string => typeof x === "string" && x !== ""))];
  if (productIds.length === 0) return null;
  const perfiles = await cliente.fotofficeProductoCatalogo.findMany({
    where: { workspaceId, productId: { in: productIds }, incomeCategoryId: { not: null } },
    select: { productId: true, incomeCategoryId: true },
  });
  const categorias = [...new Set(perfiles.map((p) => p.incomeCategoryId).filter((x): x is string => x !== null))];
  if (categorias.length === 0) return null;
  const validas = await cliente.cashCategory.findMany({
    where: { workspaceId, id: { in: categorias }, kind: "INGRESO" },
    select: { id: true },
  });
  const ok = new Set(validas.map((c) => c.id));
  const porProducto = new Map(perfiles.map((p) => [p.productId, p.incomeCategoryId]));
  for (const it of items) {
    const cat = it.productId ? porProducto.get(it.productId) : null;
    if (cat && ok.has(cat)) return cat;
  }
  return null;
}

export type DatosPedidoNuevo = {
  workspaceId: string;
  presupuestoId: string | null;
  acceptedVersionId: string | null;
  consultaLeadId: string | null;
  clientId: string;
  items: unknown;
  totals: unknown;
  total: number;
  paymentOption: OpcionPago | null;
  /** "aaaa-mm-dd" o null. */
  eventDate: string | null;
  eventLabel: string | null;
  incomeCategoryId: string | null;
  ownerUserId: number | null;
  createdByUserId: number | null;
  cuotas: readonly CuotaParaGuardar[];
  ahora: Date;
};

/**
 * Crea el pedido con su número `PEDIDO` y sus cuotas, dentro de la transacción del llamador. El id
 * se genera acá para numerar antes de insertar (`asignarNumero` es idempotente por entidad): si la
 * transacción se deshace, el número no se consume.
 */
export async function insertarPedido(tx: Tx, d: DatosPedidoNuevo): Promise<{ id: string; numero: string }> {
  const id = randomUUID();
  const numero = await asignarNumero(tx, {
    workspaceId: d.workspaceId,
    key: "PEDIDO",
    entityType: ENTIDAD_NUMERACION_PEDIDO,
    entityId: id,
    fecha: d.ahora,
  });
  await tx.fotofficePedido.create({
    data: {
      id,
      workspaceId: d.workspaceId,
      number: numero.display,
      presupuestoId: d.presupuestoId,
      acceptedVersionId: d.acceptedVersionId,
      consultaLeadId: d.consultaLeadId,
      clientId: d.clientId,
      status: "CONFIRMADO",
      items: JSON.parse(JSON.stringify(d.items ?? [])) as Prisma.InputJsonValue,
      totals: JSON.parse(JSON.stringify(d.totals ?? {})) as Prisma.InputJsonValue,
      totalArs: pesosParaBase(d.total),
      ...(d.paymentOption ? { paymentOption: d.paymentOption as unknown as Prisma.InputJsonValue } : {}),
      eventDate: d.eventDate ? fechaParaBase(d.eventDate) : null,
      eventLabel: d.eventLabel,
      incomeCategoryId: d.incomeCategoryId,
      ownerUserId: d.ownerUserId,
      createdByUserId: d.createdByUserId,
    },
    select: { id: true },
  });
  await crearCuotas(tx, { workspaceId: d.workspaceId, pedidoId: id, cuotas: d.cuotas });
  return { id, numero: numero.display };
}

/** Etiqueta corta del evento: "Categoría · Nombre", hasta 200 caracteres. */
export function etiquetaDeEvento(partes: (string | null | undefined)[]): string | null {
  const t = partes.map((p) => p?.trim()).filter(Boolean).join(" · ");
  return t ? t.slice(0, MAX_ETIQUETA_EVENTO) : null;
}

// --- Alta manual --------------------------------------------------------------------------------

export type OpcionManual = { tipo: "CONTADO" } | { tipo: "CUOTAS"; cuotas: number };

export type DatosPedidoManual = {
  clientId: unknown;
  items: unknown;
  descuento?: unknown;
  opcion: unknown;
  /** "aaaa-mm-dd" o null. */
  fechaEvento?: unknown;
  eventLabel?: unknown;
  /** Plan ajustado a mano (sin ids); sin él, el plan sale de la opción. */
  plan?: unknown;
  /** Plantilla de checklist a copiar (por nombre); sin ella, la primera; `null` = ninguna. */
  checklist?: unknown;
};

export type ResultadoAlta = { ok: true; pedidoId: string; numero: string; aviso: AvisoPlan | null } | { ok: false; error: string };

const MAX_CUOTAS_OPCION = 60;

function leerOpcionManual(raw: unknown): OpcionManual | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.tipo === "CONTADO") return { tipo: "CONTADO" };
  if (r.tipo === "CUOTAS" && typeof r.cuotas === "number" && Number.isInteger(r.cuotas) && r.cuotas >= 1 && r.cuotas <= MAX_CUOTAS_OPCION) {
    return { tipo: "CUOTAS", cuotas: r.cuotas };
  }
  return null;
}

/** La opción de pago de un pedido manual, con la misma forma que las de un presupuesto. */
export function opcionDePedidoManual(opcion: OpcionManual, total: number): OpcionPago {
  const cuotas = opcion.tipo === "CONTADO" ? 1 : opcion.cuotas;
  return {
    id: opcion.tipo === "CONTADO" ? ID_OPCION_CONTADO : `cuotas-${cuotas}`,
    tipo: opcion.tipo,
    cuotas,
    total,
    importeCuota: repartirImporte(total, cuotas)[0] ?? 0,
    descuentoPorcentaje: 0,
    interesPorcentaje: 0,
    interes: 0,
    nota: "",
    etiqueta: opcion.tipo === "CONTADO" ? "Contado" : cuotas === 1 ? "1 cuota" : `${cuotas} cuotas`,
  };
}

/**
 * "Nuevo pedido" desde un contacto, sin presupuesto: ítems de catálogo o de texto libre (con los
 * mismos validadores que los presupuestos, sólo precio de lista), descuento global opcional, una
 * opción de pago (contado o N cuotas) y, si se quiere, la fecha y la descripción del evento. El
 * total sale de los ítems (`calcularTotales`).
 */
export async function crearPedidoManual(ctx: CtxPedidos, datos: DatosPedidoManual, deps: DepsPedidos = {}): Promise<ResultadoAlta> {
  if (!puedeGestionarPedidos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const { workspaceId } = ctx;
  const ahora = deps.ahora?.() ?? new Date();
  const hoy = diaEnBuenosAires(ahora);

  if (!idValido(datos.clientId)) return { ok: false, error: MENSAJES_PEDIDO.contacto };
  const v = validarItems(datos.items);
  if (!v.ok) return v;
  if (v.valor.length === 0) return { ok: false, error: MENSAJES_PEDIDO.sinItems };
  if (v.valor.some((i) => i.modoPrecio !== "LISTA")) return { ok: false, error: MENSAJES_PEDIDO.calculo };
  const items = v.valor.map((i) => ({ ...i, calculo: null }));
  const descuento = validarDescuento(datos.descuento);
  if (!descuento.ok) return descuento;
  const opcion = leerOpcionManual(datos.opcion);
  if (!opcion) return { ok: false, error: MENSAJES_PEDIDO.opcion };
  const fechaEvento = datos.fechaEvento === undefined || datos.fechaEvento === null || datos.fechaEvento === "" ? null : datos.fechaEvento;
  if (fechaEvento !== null && !esFechaValida(fechaEvento)) return { ok: false, error: MENSAJES_PEDIDO.fecha };
  let etiqueta: string | null = null;
  if (datos.eventLabel !== undefined && datos.eventLabel !== null) {
    if (typeof datos.eventLabel !== "string") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
    if (datos.eventLabel.trim().length > MAX_ETIQUETA_EVENTO) return { ok: false, error: MENSAJES_PEDIDO.etiqueta };
    etiqueta = datos.eventLabel.trim() || null;
  }

  const contacto = await prisma.client.findFirst({ where: { id: datos.clientId, workspaceId }, select: { id: true } });
  if (!contacto) return { ok: false, error: MENSAJES_PEDIDO.contacto };
  const productIds = [...new Set(items.map((i) => i.productId).filter((x): x is string => x !== null))];
  if (productIds.length > 0) {
    const productos = await prisma.product.findMany({ where: { workspaceId, id: { in: productIds } }, select: { id: true } });
    if (productos.length !== productIds.length) return { ok: false, error: MENSAJES_PEDIDO.producto };
  }

  const totales = calcularTotales(items, descuento.valor);
  const totals: TotalesGuardados = { ...totales, descuento: descuento.valor };
  const total = totales.total;
  const paymentOption = total > 0 ? opcionDePedidoManual(opcion, total) : null;

  let cuotas: CuotaParaGuardar[];
  let aviso: AvisoPlan | null = null;
  if (datos.plan !== undefined && datos.plan !== null) {
    const p = leerCuotasEditadas(datos.plan);
    if (!p.ok) return p;
    const suma = validarPlan(p.valor, total);
    if (!suma.ok) return suma;
    cuotas = p.valor.map((c) => ({ dueDate: c.dueDate, amountArs: c.amountArs, suggestedMethod: c.suggestedMethod }));
  } else {
    const plan = paymentOption ? planDesdeOpcion(paymentOption, { desde: hoy, fechaEvento }) : { cuotas: [], aviso: null };
    cuotas = plan.cuotas;
    aviso = plan.aviso;
  }

  const conProyectos = await proyectosEncendidos(workspaceId);
  const conCitas = await agendaEncendida(workspaceId);
  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoAlta> => {
      const incomeCategoryId = await rubroDeItems(tx, workspaceId, items);
      const tareas = await titulosParaPedidoNuevo(tx, workspaceId, datos.checklist);
      if (!tareas.ok) return { ok: false, error: tareas.error };
      const r = await insertarPedido(tx, {
        workspaceId,
        presupuestoId: null,
        acceptedVersionId: null,
        consultaLeadId: null,
        clientId: contacto.id,
        items,
        totals,
        total,
        paymentOption,
        eventDate: fechaEvento,
        eventLabel: etiqueta,
        incomeCategoryId,
        ownerUserId: ctx.userId,
        createdByUserId: ctx.userId,
        cuotas,
        ahora,
      });
      await copiarTareasAlPedido(tx, { workspaceId, pedidoId: r.id, titulos: tareas.titulos });
      // Igual que al confirmar desde un presupuesto: las cuentas a pagar de sus costos (Entrega B1).
      await crearCuentasDelPedido(tx, { workspaceId, pedidoId: r.id, items, fechaEvento, createdByUserId: ctx.userId });
      // Y los proyectos de las reglas de sus productos (Etapa 4), todos: a mano no hay vista previa.
      if (conProyectos) {
        await crearProyectosDelPedido(tx, ctx, {
          pedidoId: r.id, clientId: contacto.id, items, fechaEvento, eventLabel: etiqueta, numeroPedido: r.numero,
          ownerUserId: ctx.userId, confirmadoEn: ahora,
        });
      }
      // Y las citas de las reglas de sus productos (Etapa 4, Entrega B), todas y sólo con fecha de evento.
      if (conCitas) {
        await crearCitasDelPedido(tx, workspaceId, {
          pedidoId: r.id, clientId: contacto.id, items, fechaEvento, eventLabel: etiqueta, numeroPedido: r.numero,
          ownerUserId: ctx.userId, createdByUserId: ctx.userId,
        });
      }
      return { ok: true, pedidoId: r.id, numero: r.numero, aviso };
    }, OPCIONES_TRANSACCION_PEDIDO);
  } catch (e) {
    falla("crearPedidoManual", e);
    return { ok: false, error: MENSAJES_PEDIDO.fallo };
  }
}

// --- Estados ----------------------------------------------------------------------------------

/**
 * "Cambiar estado" a mano: CONFIRMADO → EN_CURSO → COMPLETADO, o CANCELADO (desde cualquiera
 * salvo COMPLETADO) con motivo obligatorio. De CANCELADO no se vuelve. Los cobros hechos quedan.
 */
export async function cambiarEstadoPedido(
  ctx: CtxPedidos,
  pedidoId: unknown,
  a: unknown,
  motivo?: unknown,
): Promise<Resultado> {
  if (!puedeGestionarPedidos(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(pedidoId) || !esEstadoPedido(a)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  let cancelReason: string | null = null;
  if (a === "CANCELADO") {
    if (typeof motivo !== "string" || motivo.trim() === "") return { ok: false, error: MENSAJES_PEDIDO.motivo };
    if (motivo.trim().length > MAX_MOTIVO_CANCELACION) return { ok: false, error: MENSAJES_PEDIDO.motivoLargo };
    cancelReason = motivo.trim();
  }
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx): Promise<Resultado> => {
      await bloquearPedido(tx, pedidoId);
      const p = await tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { status: true } });
      if (!p || !esEstadoPedido(p.status)) return { ok: false, error: MENSAJES_PEDIDO.noExiste };
      if (!puedePasarPedido(p.status, a)) return { ok: false, error: MENSAJES_PEDIDO.transicion };
      const r = await tx.fotofficePedido.updateMany({
        where: { id: pedidoId, workspaceId, status: p.status },
        data: { status: a, ...(a === "CANCELADO" ? { cancelReason } : {}) },
      });
      return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_PEDIDO.cambio };
    });
  } catch (e) {
    falla("cambiarEstadoPedido", e);
    return { ok: false, error: MENSAJES_PEDIDO.fallo };
  }
}

// --- Rubro ------------------------------------------------------------------------------------

/**
 * Cambia el rubro de ingreso del pedido: un rubro INGRESO de Caja del mismo workspace. Con el
 * candado del pedido (como cobrar o cambiar el estado) y nunca en un pedido cancelado.
 */
export async function cambiarRubro(ctx: CtxPedidos, pedidoId: unknown, categoryId: unknown): Promise<Resultado> {
  if (!puedeGestionarPedidos(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(pedidoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  if (!idValido(categoryId)) return { ok: false, error: MENSAJES_PEDIDO.rubro };
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx): Promise<Resultado> => {
      await bloquearPedido(tx, pedidoId);
      const [p, cat] = await Promise.all([
        tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, status: true } }),
        tx.cashCategory.findFirst({ where: { id: categoryId, workspaceId, kind: "INGRESO" }, select: { id: true } }),
      ]);
      if (!p) return { ok: false, error: MENSAJES_PEDIDO.noExiste };
      if (p.status === "CANCELADO") return { ok: false, error: MENSAJES_PEDIDO.cancelado };
      if (!cat) return { ok: false, error: MENSAJES_PEDIDO.rubro };
      const r = await tx.fotofficePedido.updateMany({
        where: { id: pedidoId, workspaceId, status: p.status },
        data: { incomeCategoryId: cat.id },
      });
      return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_PEDIDO.cambio };
    });
  } catch (e) {
    falla("cambiarRubro", e);
    return { ok: false, error: MENSAJES_PEDIDO.fallo };
  }
}

// --- Lecturas ---------------------------------------------------------------------------------

export type FilaPedido = {
  id: string;
  numero: string;
  estado: EstadoPedido;
  clientId: string;
  contacto: string;
  presupuestoId: string | null;
  consultaLeadId: string | null;
  /** "aaaa-mm-dd". */
  eventDate: string | null;
  eventLabel: string | null;
  total: number;
  cobrado: number;
  saldo: number;
  aCobrar: number;
  vencido: number;
  proximoVencimiento: string | null;
  createdAt: Date;
};

export type FiltrosPedidos = { clientId?: string | null; consultaLeadId?: string | null; presupuestoId?: string | null };

const TOPE_LISTA = 500;

export const SELECT_PEDIDO = {
  id: true,
  number: true,
  status: true,
  clientId: true,
  presupuestoId: true,
  consultaLeadId: true,
  eventDate: true,
  eventLabel: true,
  totalArs: true,
  createdAt: true,
} as const;

type FilaBase = {
  id: string;
  number: string;
  status: string;
  clientId: string;
  presupuestoId: string | null;
  consultaLeadId: string | null;
  eventDate: Date | null;
  eventLabel: string | null;
  totalArs: { toString(): string };
  createdAt: Date;
};

/** Filas con saldo y vencimientos (para las tarjetas y el listado). */
export async function completarFilas(workspaceId: string, filas: readonly FilaBase[], ahora: Date): Promise<FilaPedido[]> {
  if (filas.length === 0) return [];
  const hoy = diaEnBuenosAires(ahora);
  const [planes, contactos] = await Promise.all([
    planesDe(workspaceId, filas.map((f) => f.id)),
    prisma.client.findMany({
      where: { workspaceId, id: { in: [...new Set(filas.map((f) => f.clientId))] } },
      select: { id: true, firstName: true, lastName: true, businessName: true },
    }),
  ]);
  const contactoPorId = new Map(contactos.map((c) => [c.id, c]));
  const out: FilaPedido[] = [];
  for (const f of filas) {
    if (!esEstadoPedido(f.status)) continue;
    const plan = planes.get(f.id) ?? { cuotas: [], imputaciones: [] };
    const r = resumenDePlan(plan.cuotas, plan.imputaciones, { hoy, estadoPedido: f.status, total: pesosDeBase(f.totalArs) });
    out.push({
      id: f.id,
      numero: f.number,
      estado: f.status,
      clientId: f.clientId,
      contacto: nombreDeContacto(contactoPorId.get(f.clientId)),
      presupuestoId: f.presupuestoId,
      consultaLeadId: f.consultaLeadId,
      eventDate: f.eventDate ? fechaDeBase(f.eventDate) : null,
      eventLabel: f.eventLabel,
      total: r.total,
      cobrado: r.cobrado,
      saldo: r.saldo,
      aCobrar: r.aCobrar,
      vencido: r.vencido,
      proximoVencimiento: r.proximoVencimiento,
      createdAt: f.createdAt,
    });
  }
  return out;
}

/** Pedidos del workspace (tarjetas del contacto, de la consulta o del presupuesto), los más nuevos primero. */
export async function listarPedidos(ctx: CtxPedidos, filtros: FiltrosPedidos = {}, deps: DepsPedidos = {}): Promise<FilaPedido[]> {
  if (!puedeVerPedidos(ctx)) return [];
  const { workspaceId } = ctx;
  const filas = await prisma.fotofficePedido.findMany({
    where: {
      workspaceId,
      ...(idValido(filtros.clientId) ? { clientId: filtros.clientId } : {}),
      ...(idValido(filtros.consultaLeadId) ? { consultaLeadId: filtros.consultaLeadId } : {}),
      ...(idValido(filtros.presupuestoId) ? { presupuestoId: filtros.presupuestoId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: TOPE_LISTA,
    select: SELECT_PEDIDO,
  });
  return completarFilas(workspaceId, filas, deps.ahora?.() ?? new Date());
}

/** El pedido de un presupuesto (para el enlace "Ver pedido" en el presupuesto aceptado), o null. */
export async function pedidoDePresupuesto(ctx: CtxPedidos, presupuestoId: unknown): Promise<{ id: string; numero: string } | null> {
  if (!puedeVerPedidos(ctx) || !idValido(presupuestoId)) return null;
  const p = await prisma.fotofficePedido.findFirst({ where: { presupuestoId, workspaceId: ctx.workspaceId }, select: { id: true, number: true } });
  return p ? { id: p.id, numero: p.number } : null;
}

export type CobroDelPedido = {
  id: string;
  receiptNumber: string;
  paidAt: Date;
  /** Uno de los 5 medios de Caja (`MEDIOS_COBRO`). */
  method: string;
  amountArs: number;
  voidedAt: Date | null;
  voidReason: string | null;
};

export type DetallePedido = {
  id: string;
  numero: string;
  estado: EstadoPedido;
  cancelReason: string | null;
  clientId: string;
  contacto: string;
  presupuestoId: string | null;
  acceptedVersionId: string | null;
  consultaLeadId: string | null;
  eventDate: string | null;
  eventLabel: string | null;
  /** Con el cálculo (costos) sólo si `veCostos`. */
  items: ItemPresupuesto[] | ItemEquipo[];
  totals: TotalesGuardados | null;
  paymentOption: OpcionPago | null;
  incomeCategoryId: string | null;
  rubro: string | null;
  ownerUserId: number | null;
  plan: ResumenPlan;
  cobros: CobroDelPedido[];
  veCostos: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** La ficha del pedido. Sin token. Los ítems van sin costos para quien no los puede ver. */
export async function leerPedido(ctx: CtxPedidos, pedidoId: unknown, deps: DepsPedidos = {}): Promise<DetallePedido | null> {
  if (!puedeVerPedidos(ctx) || !idValido(pedidoId)) return null;
  const { workspaceId } = ctx;
  const ahora = deps.ahora?.() ?? new Date();
  const p = await prisma.fotofficePedido.findFirst({
    where: { id: pedidoId, workspaceId },
    select: {
      ...SELECT_PEDIDO,
      cancelReason: true,
      acceptedVersionId: true,
      items: true,
      totals: true,
      paymentOption: true,
      incomeCategoryId: true,
      ownerUserId: true,
      updatedAt: true,
    },
  });
  if (!p || !esEstadoPedido(p.status)) return null;
  const conCostos = veCostosDePedido(ctx);
  const [planes, contacto, rubro, cobros] = await Promise.all([
    planesDe(workspaceId, [p.id]),
    prisma.client.findFirst({ where: { id: p.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } }),
    p.incomeCategoryId
      ? prisma.cashCategory.findFirst({ where: { id: p.incomeCategoryId, workspaceId }, select: { name: true } })
      : Promise.resolve(null),
    prisma.fotofficeCobro.findMany({
      where: { workspaceId, pedidoId: p.id },
      orderBy: [{ paidAt: "asc" }],
      select: { id: true, receiptNumber: true, paidAt: true, method: true, amountArs: true, voidedAt: true, voidReason: true },
    }),
  ]);
  const plan = planes.get(p.id) ?? { cuotas: [], imputaciones: [] };
  const items = itemsGuardados(p.items);
  return {
    id: p.id,
    numero: p.number,
    estado: p.status,
    cancelReason: p.cancelReason,
    clientId: p.clientId,
    contacto: nombreDeContacto(contacto),
    presupuestoId: p.presupuestoId,
    acceptedVersionId: p.acceptedVersionId,
    consultaLeadId: p.consultaLeadId,
    eventDate: p.eventDate ? fechaDeBase(p.eventDate) : null,
    eventLabel: p.eventLabel,
    items: conCostos ? items : items.map(itemParaEquipo),
    totals: (p.totals as TotalesGuardados | null) ?? null,
    paymentOption: (p.paymentOption as OpcionPago | null) ?? null,
    incomeCategoryId: p.incomeCategoryId,
    rubro: rubro?.name ?? null,
    ownerUserId: p.ownerUserId,
    plan: resumenDePlan(plan.cuotas, plan.imputaciones, { hoy: diaEnBuenosAires(ahora), estadoPedido: p.status, total: pesosDeBase(p.totalArs) }),
    cobros: cobros.map((c) => ({
      id: c.id,
      receiptNumber: c.receiptNumber,
      paidAt: c.paidAt,
      method: c.method,
      amountArs: pesosDeBase(c.amountArs),
      voidedAt: c.voidedAt,
      voidReason: c.voidReason,
    })),
    veCostos: conCostos,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
