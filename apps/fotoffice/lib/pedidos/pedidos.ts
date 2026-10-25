import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { MENSAJE_INSUMO_NO_SE_VENDE, esVendible } from "@/lib/sales/vendible";
import { asignarNumero } from "@/lib/numeracion/asignar";
import { validarDescuento, validarItems, type ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { calcularTotales } from "@/lib/presupuestos/totales";
import { itemParaEquipo, itemsGuardados, type ItemEquipo, type TotalesGuardados } from "@/lib/presupuestos/versiones";
import { agendaEncendida, crearCitasDelPedido } from "@/lib/agenda/crear";
import type { CtxCircuitos } from "@/lib/circuitos/acceso";
import { SALIDAS } from "@/lib/circuitos/constantes";
import { cerrarEnTransaccion, esEtapaDeEntrega, esRechazo } from "@/lib/circuitos/recorridos";
import { crearProyectosDelPedido, proyectosEncendidos } from "@/lib/proyectos/crear";
import { lockStockRows } from "@/lib/sales/stock-lock";
import { applyStockMovement } from "@/lib/sales/variant-stock";
import { aplicarConsumo, consumosPendientesDeDevolver, devolverConsumos, planificarConsumo } from "@/lib/stock/consumo-servidor";
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
  /** Clave del alta (único por workspace): el mismo cobro repetido no crea otro pedido. */
  altaKey?: string | null;
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
      altaKey: d.altaKey ?? null,
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
  /**
   * Clave del alta (la arma el Mostrador una vez por cobro). Con la misma clave, la segunda
   * llamada devuelve el pedido de la primera (`repetido: true`) sin volver a escribir nada: un
   * doble clic o un reintento después de un corte no crean dos pedidos ni apartan dos veces.
   */
  clave?: unknown;
  /** Ids de los ítems que el cliente pasa a retirar: abren su trabajo en «Para retirar». */
  paraRetirar?: unknown;
  /** Unidades que aparta la seña: `{ itemId, productId, variantId, cantidad }[]`. */
  apartar?: unknown;
};

export type ResultadoAlta =
  | { ok: true; pedidoId: string; numero: string; aviso: AvisoPlan | null; repetido: boolean }
  | { ok: false; error: string };

const MAX_CUOTAS_OPCION = 60;

/** Mismo formato que la clave del cobro del Mostrador (`CLAVE` de `ventas/pedido-actions.ts`). */
const CLAVE_ALTA = /^[A-Za-z0-9_-]{8,90}$/;

type LineaApartada = { itemId: string; productId: string; variantId: string | null; cantidad: number };

/** La clave del alta: `null` si no vino; `undefined` si vino con otro formato. */
function leerClave(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  return typeof raw === "string" && CLAVE_ALTA.test(raw) ? raw : undefined;
}

/** Posiciones (en `items`) de los ids marcados «para retirar»; null si alguno no es un ítem. */
function leerParaRetirar(raw: unknown, items: readonly Pick<ItemPresupuesto, "id">[]): Set<number> | null {
  if (raw === undefined || raw === null) return new Set();
  if (!Array.isArray(raw)) return null;
  const posiciones = new Set<number>();
  for (const id of raw) {
    const i = typeof id === "string" ? items.findIndex((it) => it.id === id) : -1;
    if (i < 0) return null;
    posiciones.add(i);
  }
  return posiciones;
}

/**
 * Las líneas que aparta la seña. Cada una apunta a un ítem del pedido (por id) con ese mismo
 * producto, y la cantidad es un entero positivo; entre todas las de un ítem no apartan más que
 * su cantidad (una línea repetida no aparta dos veces). null si alguna no cuadra (el talle se
 * verifica contra la base aparte).
 */
function leerApartar(raw: unknown, items: readonly Pick<ItemPresupuesto, "id" | "productId" | "cantidad">[]): LineaApartada[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: LineaApartada[] = [];
  const porItem = new Map<string, number>();
  for (const l of raw) {
    if (!l || typeof l !== "object" || Array.isArray(l)) return null;
    const r = l as Record<string, unknown>;
    if (typeof r.itemId !== "string" || !idValido(r.productId)) return null;
    const it = items.find((x) => x.id === r.itemId);
    if (!it || it.productId !== r.productId) return null;
    const variantId = r.variantId === undefined || r.variantId === null ? null : r.variantId;
    if (variantId !== null && !idValido(variantId)) return null;
    if (typeof r.cantidad !== "number" || !Number.isSafeInteger(r.cantidad) || r.cantidad <= 0) return null;
    const suma = (porItem.get(it.id) ?? 0) + r.cantidad;
    if (suma > it.cantidad) return null;
    porItem.set(it.id, suma);
    out.push({ itemId: r.itemId, productId: r.productId, variantId, cantidad: r.cantidad });
  }
  return out;
}

/** El pedido que ya se dio de alta con esta clave, o null. */
async function pedidoDeLaClave(workspaceId: string, clave: string): Promise<{ id: string; number: string } | null> {
  return prisma.fotofficePedido.findFirst({ where: { workspaceId, altaKey: clave }, select: { id: true, number: true } });
}

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
    medio: null,
    descuentoTransferenciaPorcentaje: 0,
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

  const clave = leerClave(datos.clave);
  if (clave === undefined) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  // Con la misma clave ya hay pedido: es el mismo cobro que vuelve. Se devuelve tal cual, antes de
  // validar nada (lo que cambió desde entonces no deshace un pedido que ya existe).
  if (clave !== null) {
    const ya = await pedidoDeLaClave(workspaceId, clave);
    if (ya) return { ok: true, pedidoId: ya.id, numero: ya.number, aviso: null, repetido: true };
  }

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
    const productos = await prisma.product.findMany({ where: { workspaceId, id: { in: productIds } }, select: { id: true, kind: true } });
    if (productos.length !== productIds.length) return { ok: false, error: MENSAJES_PEDIDO.producto };
    if (productos.some((p) => !esVendible(p.kind))) return { ok: false, error: MENSAJE_INSUMO_NO_SE_VENDE };
  }
  const paraRetirar = leerParaRetirar(datos.paraRetirar, items);
  if (!paraRetirar) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const apartar = leerApartar(datos.apartar, items);
  if (!apartar) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  // El talle tiene que ser de ese producto: `applyStockMovement` lo rechazaría igual, pero con la
  // transacción ya abierta y como una falla; acá es un dato inválido.
  const variantIds = [...new Set(apartar.map((l) => l.variantId).filter((x): x is string => x !== null))];
  if (variantIds.length > 0) {
    const talles = await prisma.productVariant.findMany({ where: { workspaceId, id: { in: variantIds } }, select: { id: true, productId: true } });
    const productoDelTalle = new Map(talles.map((t) => [t.id, t.productId]));
    if (apartar.some((l) => l.variantId !== null && productoDelTalle.get(l.variantId) !== l.productId)) {
      return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
    }
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
        altaKey: clave,
      });
      await copiarTareasAlPedido(tx, { workspaceId, pedidoId: r.id, titulos: tareas.titulos });
      await apartarStock(tx, { workspaceId, pedidoId: r.id, items, lineas: apartar, createdByUserId: ctx.userId });
      // Igual que al confirmar desde un presupuesto: las cuentas a pagar de sus costos (Entrega B1).
      await crearCuentasDelPedido(tx, { workspaceId, pedidoId: r.id, items, fechaEvento, createdByUserId: ctx.userId });
      // Y los proyectos de las reglas de sus productos (Etapa 4), todos: a mano no hay vista previa.
      if (conProyectos) {
        await crearProyectosDelPedido(tx, ctx, {
          pedidoId: r.id, clientId: contacto.id, items, fechaEvento, eventLabel: etiqueta, numeroPedido: r.numero,
          ownerUserId: ctx.userId, confirmadoEn: ahora, paraRetirar,
        });
      }
      // Y las citas de las reglas de sus productos (Etapa 4, Entrega B), todas y sólo con fecha de evento.
      if (conCitas) {
        await crearCitasDelPedido(tx, workspaceId, {
          pedidoId: r.id, clientId: contacto.id, items, fechaEvento, eventLabel: etiqueta, numeroPedido: r.numero,
          ownerUserId: ctx.userId, createdByUserId: ctx.userId,
        });
      }
      return { ok: true, pedidoId: r.id, numero: r.numero, aviso, repetido: false };
    }, OPCIONES_TRANSACCION_PEDIDO);
  } catch (e) {
    // Otra llamada con la misma clave ganó la carrera (único `workspaceId`+`altaKey`): ésta se
    // deshizo entera y el pedido es el de la otra.
    if (clave !== null && (e as { code?: unknown } | null)?.code === "P2002") {
      const ganador = await pedidoDeLaClave(workspaceId, clave);
      if (ganador) return { ok: true, pedidoId: ganador.id, numero: ganador.number, aviso: null, repetido: true };
    }
    falla("crearPedidoManual", e);
    return { ok: false, error: MENSAJES_PEDIDO.fallo };
  }
}

/**
 * Mueve el stock de un pedido recién tomado, en dos partes:
 *
 * - Aparta el stock de la seña (`lineas`): un movimiento `PEDIDO` por línea, sólo de los productos
 *   que controlan stock (los demás no tienen existencia que mover). Va por `applyStockMovement`,
 *   como todo lo que mueve stock; la nota `item:<id>` empareja el movimiento con su línea para
 *   devolverlo si el pedido se cancela. Al confirmar desde un presupuesto no hay líneas: ahí no se
 *   aparta producto, como siempre.
 * - Descuenta los insumos de las recetas (copias del kit, sobres…) de TODOS los ítems del pedido
 *   (`items`), por su cantidad completa, estén o no en `lineas` y controle o no stock el producto:
 *   una copia 15x20 no tiene existencia propia, pero gasta papel, y se descuenta al tomar el pedido.
 *   Los opcionales no, igual que en los totales y en los costos: no se compraron. Un movimiento
 *   `CONSUMO` por insumo e ítem, con la nota `consumo:item:<id>` (nunca `item:<id>`, que es la de
 *   los productos apartados). Un pedido nunca genera una venta, así que esto no se descuenta dos
 *   veces con `recordSale`.
 */
export async function apartarStock(
  tx: Tx,
  d: {
    workspaceId: string;
    pedidoId: string;
    items: readonly Pick<ItemPresupuesto, "id" | "productId" | "cantidad" | "opcional">[];
    lineas: readonly LineaApartada[];
    createdByUserId: number | null;
  },
): Promise<void> {
  // Qué insumos gasta el pedido: sólo lecturas, antes de bloquear, porque sus ids tienen que entrar
  // en el mismo bloqueo que los productos.
  const plan = await planificarConsumo(
    tx,
    d.workspaceId,
    d.items.filter((it) => !it.opcional && it.productId).map((it) => ({ ref: it.id, productId: it.productId, qty: it.cantidad })),
  );
  // Nada que apartar ni que descontar: ni siquiera se bloquea.
  if (d.lineas.length === 0 && plan.consumos.length === 0) return;
  const productIds = [...new Set(d.lineas.map((l) => l.productId))];
  // Lo primero, como toda escritura de stock: bloquear productos y después talles, en orden de id
  // (`stock-lock.ts`). `applyStockMovement` escribe el talle antes que el producto; sin este
  // bloqueo, una seña al mismo tiempo que una venta o un pedido online del mismo producto podía
  // quedar esperando a la otra (interbloqueo) y Postgres abortaba una de las dos. Los insumos son
  // filas de `Product`: van en la MISMA llamada, no en una segunda, para no romper ese orden.
  await lockStockRows(tx, {
    workspaceId: d.workspaceId,
    productIds: [...productIds, ...plan.insumoIds],
    variantIds: d.lineas.map((l) => l.variantId).filter((x): x is string => x !== null),
  });
  const productos = await tx.product.findMany({
    where: { workspaceId: d.workspaceId, id: { in: productIds } },
    select: { id: true, tracksStock: true },
  });
  const controla = new Map(productos.map((p) => [p.id, p.tracksStock]));
  for (const l of d.lineas) {
    if (controla.get(l.productId) !== true) continue;
    await applyStockMovement(tx, {
      workspaceId: d.workspaceId,
      productId: l.productId,
      variantId: l.variantId,
      qty: -l.cantidad,
      reason: "PEDIDO",
      sourceModule: "pedidos",
      sourceRef: d.pedidoId,
      note: `item:${l.itemId}`,
      unitCostArs: null,
      createdByUserId: d.createdByUserId,
    });
  }
  await aplicarConsumo(tx, {
    workspaceId: d.workspaceId,
    plan,
    sourceModule: "pedidos",
    sourceRef: d.pedidoId,
    createdByUserId: d.createdByUserId,
  });
}

/**
 * Al cancelar un pedido, devuelve el stock que la seña apartó y no se entregó. Una línea se
 * considera entregada si algún trabajo de su posición terminó (`TERMINADO`) o su recorrido abierto
 * está en una etapa de entrega (la misma regla del candado del saldo: `esEtapaDeEntrega`). Una
 * línea sin trabajo (Proyectos apagado) vuelve. Idempotente: una línea que ya tiene su
 * `DEVOLUCION` (mismo `sourceRef` y nota) no se repite.
 *
 * Con la misma regla devuelve los insumos que la seña descontó (`CONSUMO`, nota
 * `consumo:item:<id>`), sólo de las líneas no entregadas: lo entregado ya gastó su papel. No se
 * recalculan con la receta de hoy: vuelve lo que dicen los movimientos, menos lo ya devuelto.
 * Las devoluciones de insumos (`DEVOLUCION` con nota `consumo:item:…`) nunca se confunden con las
 * de productos: éstas se emparejan por la nota exacta `item:<id>`, y aquéllas por otro prefijo.
 */
async function devolverStockApartado(tx: Tx, d: { workspaceId: string; pedidoId: string; createdByUserId: number | null }): Promise<void> {
  const movimientos = await tx.stockMovement.findMany({
    where: { workspaceId: d.workspaceId, sourceModule: "pedidos", sourceRef: d.pedidoId, reason: { in: ["PEDIDO", "DEVOLUCION"] } },
    select: { productId: true, variantId: true, qty: true, reason: true, note: true },
  });
  const yaDevueltas = new Set(movimientos.filter((m) => m.reason === "DEVOLUCION").map((m) => m.note));
  const apartados = movimientos.filter((m) => m.reason === "PEDIDO" && m.note !== null && !yaDevueltas.has(m.note));

  const pedido = await tx.fotofficePedido.findFirst({ where: { id: d.pedidoId, workspaceId: d.workspaceId }, select: { items: true } });
  const items = itemsGuardados(pedido?.items);
  const posicionDe = new Map(items.map((it, i) => [`item:${it.id}`, i]));
  const entregadas = await posicionesEntregadas(tx, d.workspaceId, d.pedidoId);
  const aDevolver = apartados.filter((m) => {
    const posicion = posicionDe.get(m.note!);
    return posicion === undefined || !entregadas.has(posicion);
  });

  // Los insumos de las líneas no entregadas. Se leen ANTES de bloquear (sólo lectura): sus ids
  // entran en el mismo bloqueo que los productos.
  const pendientes = await consumosPendientesDeDevolver(tx, {
    workspaceId: d.workspaceId,
    sourceModule: "pedidos",
    sourceRef: d.pedidoId,
    refs: new Set(items.filter((_, i) => !entregadas.has(i)).map((it) => it.id)),
  });
  if (aDevolver.length === 0 && pendientes.length === 0) return;

  // Mismo orden de bloqueo que al apartar (`stock-lock.ts`), productos e insumos en una llamada.
  await lockStockRows(tx, {
    workspaceId: d.workspaceId,
    productIds: [...new Set([...aDevolver.map((m) => m.productId), ...pendientes.map((p) => p.insumoId)])],
    variantIds: aDevolver.map((m) => m.variantId).filter((x): x is string => x !== null),
  });
  for (const m of aDevolver) {
    await applyStockMovement(tx, {
      workspaceId: d.workspaceId,
      productId: m.productId,
      variantId: m.variantId,
      qty: -m.qty,
      reason: "DEVOLUCION",
      sourceModule: "pedidos",
      sourceRef: d.pedidoId,
      note: m.note,
      unitCostArs: null,
      createdByUserId: d.createdByUserId,
    });
  }
  await devolverConsumos(tx, {
    workspaceId: d.workspaceId,
    pendientes,
    sourceModule: "pedidos",
    sourceRef: d.pedidoId,
    createdByUserId: d.createdByUserId,
  });
}

/** Posiciones de ítem del pedido cuyo trabajo ya se entregó (terminado, o en una etapa de entrega). */
async function posicionesEntregadas(tx: Tx, workspaceId: string, pedidoId: string): Promise<Set<number>> {
  const trabajos = await tx.fotofficeProyecto.findMany({
    where: { workspaceId, pedidoId, pedidoItemIndex: { not: null } },
    select: { id: true, pedidoItemIndex: true },
  });
  const entregadas = new Set<number>();
  if (trabajos.length === 0) return entregadas;
  const recorridos = await tx.fotofficeJourney.findMany({
    where: { workspaceId, subjectType: "PROYECTO", subjectId: { in: trabajos.map((t) => t.id) } },
    select: { subjectId: true, stageId: true, circuitId: true, outcome: true },
  });
  const cacheEtapas = new Map<string, { id: string; name: string; color: string; order: number }[]>();
  for (const t of trabajos) {
    if (t.pedidoItemIndex === null) continue;
    for (const j of recorridos.filter((r) => r.subjectId === t.id)) {
      if (j.outcome === "TERMINADO") {
        entregadas.add(t.pedidoItemIndex);
      } else if (j.outcome === null && j.stageId !== null) {
        let activas = cacheEtapas.get(j.circuitId);
        if (!activas) {
          activas = await tx.fotofficeStage.findMany({
            where: { circuitId: j.circuitId, archivedAt: null },
            select: { id: true, name: true, color: true, order: true },
          });
          cacheEtapas.set(j.circuitId, activas);
        }
        const actual = activas.find((e) => e.id === j.stageId);
        if (actual && esEtapaDeEntrega(actual, activas)) entregadas.add(t.pedidoItemIndex);
      }
    }
  }
  return entregadas;
}

/** Motivo con el que se cierran los trabajos de un pedido cancelado: el de cierre por defecto del motor. */
const MOTIVO_CANCELACION_PEDIDO = "Otro";

/**
 * Al cancelar un pedido, cierra como `CANCELADO` los recorridos abiertos de sus trabajos, por el
 * motor y como Sistema (queda el paso en el historial). Va DESPUÉS de `devolverStockApartado`, que
 * decide qué se entregó mirando esos mismos recorridos abiertos. El fracaso exige un motivo activo:
 * «Otro» si está, si no el primero activo. Sin ninguno, o si un recorrido cambió en el medio, el
 * trabajo queda abierto y se avisa en el log; la cancelación sigue. Los ya cerrados no se tocan.
 */
async function cerrarTrabajosDelPedido(tx: Tx, d: { workspaceId: string; pedidoId: string; motivo: string }): Promise<void> {
  const { workspaceId, pedidoId } = d;
  const trabajos = await tx.fotofficeProyecto.findMany({ where: { workspaceId, pedidoId }, select: { id: true } });
  if (trabajos.length === 0) return;
  const abiertos = await tx.fotofficeJourney.findMany({
    where: { workspaceId, subjectType: "PROYECTO", subjectId: { in: trabajos.map((t) => t.id) }, kind: "TRABAJO", closedAt: null, stageId: { not: null } },
    select: { id: true },
  });
  if (abiertos.length === 0) return;

  const motivo =
    (await tx.fotofficeLossReason.findFirst({ where: { workspaceId, name: MOTIVO_CANCELACION_PEDIDO, isActive: true }, select: { id: true } })) ??
    (await tx.fotofficeLossReason.findFirst({ where: { workspaceId, isActive: true }, select: { id: true }, orderBy: { order: "asc" } }));
  if (!motivo) {
    console.warn("[pedidos] cancelar: sin motivo de cierre activo, los trabajos quedan abiertos", { workspaceId, pedidoId, trabajos: abiertos.length });
    return;
  }

  // El contexto de sistema del motor (`contextoDeSistema`), sin traer `acceso.ts` y su sesión.
  const ctx: CtxCircuitos = { workspaceId, userId: null, userLabel: "Sistema", role: null };
  const nota = `Se canceló el pedido: ${d.motivo}`;
  for (const j of abiertos) {
    try {
      await cerrarEnTransaccion(tx, ctx, j.id, SALIDAS.TRABAJO.fracaso, motivo.id, nota);
    } catch (e) {
      // Un rechazo del motor (p. ej. se movió en el medio) no escribió nada: no frena la cancelación.
      if (!esRechazo(e)) throw e;
      console.warn("[pedidos] cancelar: un trabajo no se pudo cerrar", { workspaceId, pedidoId, journeyId: j.id });
    }
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
      if (r.count !== 1) return { ok: false, error: MENSAJES_PEDIDO.cambio };
      // Cancelar devuelve el stock apartado que no se entregó, en la misma transacción.
      // Después, cierra sus trabajos abiertos (la devolución necesita verlos como estaban).
      if (a === "CANCELADO") {
        await devolverStockApartado(tx, { workspaceId, pedidoId, createdByUserId: ctx.userId });
        await cerrarTrabajosDelPedido(tx, { workspaceId, pedidoId, motivo: cancelReason! });
      }
      return { ok: true };
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
