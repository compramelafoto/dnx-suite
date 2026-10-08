import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { proveedoresDelWorkspace } from "@/lib/catalogo/costos";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { clientDisplayName } from "@/lib/clients/display";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { decimalArsToMinor } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { itemsGuardados } from "@/lib/presupuestos/versiones";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { MENSAJES_PEDIDO, puedeGestionarPedidos, puedeVerPedidos, veCostosDePedido, type CtxPedidos } from "./acceso";
import { contramovimiento, Corte, instanteDelPago, MAX_MOTIVO_ANULACION } from "./cobros";
import { esMedioCobro, type MedioCobro } from "./constantes";
import { cuentasDesdeCostos, type ItemParaCostos } from "./costos";
import { estadoDeCuenta, margenesDelPedido, type EstadoCuenta, type Margenes } from "./cuentas-pagar-estado";
import { bloquearPedido, fechaDeBase, fechaParaBase, pesosDeBase, pesosParaBase } from "./plan";
import { aCentavos, desdeCentavos, esFechaValida, tieneHastaDosDecimales } from "./plan-cuotas";

/**
 * Cuentas a pagar de un pedido (Entrega B1): lo que se le debe a cada proveedor por un trabajo.
 *
 * **Nacen** al confirmar el pedido (y al darlo de alta a mano), en la misma transacción, desde los
 * costos-plantilla de sus productos y de los componentes de sus combos (`cuentasDesdeCostos`). El
 * rubro de costo queda vacío: se elige al pagar. "Generar costos" las crea para los pedidos que no
 * tienen ninguna (los confirmados antes de la Entrega B1): si el pedido ya tiene alguna cuenta,
 * pagada, pendiente o con un pago anulado, no hace nada. Nunca mira `costoPlantillaId`, que se
 * pierde cuando alguien edita los costos del producto en el catálogo.
 *
 * **Se editan, agregan y borran** por pedido sólo mientras no estén pagadas.
 *
 * **Pagar** va en UNA transacción con el candado del pedido (`bloquearPedido`, el mismo de los
 * cobros): EGRESO en Caja con `sourceModule` "pedidos-pagos", `sourceRef` = id de la cuenta, el
 * proveedor como contacto, el rubro de costo elegido (obligatorio, un rubro EGRESO del workspace)
 * y la cuenta de Caja del depósito automático según el medio. Con Caja apagada o sin una cuenta de
 * Caja, se rechaza (igual que los cobros). Doble clic: la clave del formulario es única por
 * workspace; la misma clave devuelve el pago que ya estaba sin escribir otro egreso.
 *
 * Si un pago se anuló y la cuenta se vuelve a pagar, el nuevo egreso no puede repetir el
 * `sourceRef` (`(sourceModule, sourceRef)` es único en Caja): lleva `<id de la cuenta>:<clave del
 * formulario>`.
 *
 * **Anular el pago** exige motivo: contramovimiento con `buildReversal` (el de los cobros), la
 * cuenta vuelve a pendiente y guarda cuándo y por qué se anuló. Una segunda anulación no hace nada.
 * Caja no deja anular a mano estos egresos ni su contramovimiento (`lib/cash/reverse.ts`).
 *
 * **Permisos:** "Gestionar" en Pedidos para escribir y, además, ver costos (`veCostosDePedido`):
 * los importes de las cuentas a pagar sólo los ve quien tiene `configurar` o `verDinero`. Leer,
 * "Ver" + `veCostosDePedido`. Nunca loguea datos personales: sólo códigos.
 */

type Tx = Prisma.TransactionClient;

export const MODULO_CAJA_PAGOS = "pedidos-pagos";
/** Tope del importe: lo que entra en `DECIMAL(12,2)`. */
export const MAX_IMPORTE_CUENTA = 999_999_999.99;
export const MAX_CONCEPTO_CUENTA = 200;
/** Cuentas por pedido (un resguardo: un pedido normal tiene unas pocas). */
export const MAX_CUENTAS_POR_PEDIDO = 200;
const CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{8,100}$/;
/** Hasta dónde se baja dentro de combos anidados al juntar sus componentes. */
const PROFUNDIDAD_COMBOS = 10;

export const MENSAJES_CUENTA = {
  noExiste: "No encontramos esa cuenta a pagar.",
  concepto: `Escribí el concepto (hasta ${MAX_CONCEPTO_CUENTA} caracteres).`,
  importe: "El importe tiene que ser mayor que cero, con hasta dos decimales.",
  importeTope: "El importe es demasiado grande.",
  vencimiento: "La fecha de vencimiento no es válida.",
  proveedor: "El proveedor tiene que ser un contacto tuyo.",
  rubro: "Elegí un rubro de costo (egreso) de Caja.",
  pagada: "La cuenta ya está pagada: para cambiarla, primero anulá el pago.",
  yaPagada: "Esa cuenta ya está pagada.",
  noPagada: "Esa cuenta no tiene un pago para anular.",
  cancelado: "El pedido está cancelado: no se le agregan costos.",
  tope: `Un pedido puede tener hasta ${MAX_CUENTAS_POR_PEDIDO} cuentas a pagar.`,
  yaTieneCostos: "El pedido ya tiene costos cargados: no se generan de nuevo.",
  sinCostos: "Los productos del pedido no tienen costos cargados en el catálogo.",
  fecha: "La fecha del pago no es válida.",
  fechaFutura: "La fecha del pago no puede ser posterior a hoy.",
  medio: "Elegí el medio de pago.",
  clave: "Falta la clave del formulario. Volvé a abrirlo.",
  claveDeOtra: "Ese formulario ya se usó para otra cuenta. Volvé a abrirlo.",
  claveUsada: "Ese formulario ya se usó. Volvé a abrirlo.",
  sinCaja: "Para registrar pagos encendé el módulo Caja: cada pago sale de Caja.",
  sinCuenta: "Para registrar el pago hace falta una cuenta de Caja de donde sale (que no sea la caja fuerte). Creala en Caja → Cuentas y volvé a intentar.",
  motivo: "Escribí por qué se anula el pago.",
  motivoLargo: `El motivo puede tener hasta ${MAX_MOTIVO_ANULACION} caracteres.`,
  sinCajaAnular: "Para anular pagos encendé el módulo Caja: el contramovimiento va a Caja.",
  fallo: "No se pudo guardar la cuenta a pagar. Probá de nuevo.",
  falloPago: "No se pudo registrar el pago. Probá de nuevo.",
  falloAnular: "No se pudo anular el pago. Probá de nuevo.",
} as const;

export type ResultadoCuenta = { ok: true; cuentaId: string; pedidoId: string | null } | { ok: false; error: string };
export type ResultadoGenerar = { ok: true; creadas: number; mensaje: string | null } | { ok: false; error: string };
export type ResultadoPago =
  | { ok: true; cuentaId: string; pedidoId: string | null; creado: boolean; movimientoId: string | null }
  | { ok: false; error: string };
export type ResultadoAnularPago = { ok: true; yaAnulado: boolean; pedidoId: string | null } | { ok: false; error: string };

export type DepsCuentas = { ahora?: () => Date };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function codigoDe(e: unknown): string | null {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : null;
}

function falla(donde: string, error: unknown): void {
  console.error(`[pedidos] ${donde} falló`, { codigo: codigoDe(error) });
}

/** Escribir cuentas a pagar: "Gestionar" en Pedidos y ver costos. */
export function puedeGestionarCuentas(ctx: CtxPedidos): boolean {
  return puedeGestionarPedidos(ctx) && veCostosDePedido(ctx);
}

/** Leer cuentas a pagar (importes incluidos): "Ver" en Pedidos y ver costos. */
export function puedeVerCuentas(ctx: CtxPedidos): boolean {
  return puedeVerPedidos(ctx) && veCostosDePedido(ctx);
}

/**
 * Candado de la cuenta: el del pedido si tiene (serializa con los cobros, el plan y "Generar
 * costos"); si es suelta, uno propio.
 */
function bloquearCuenta(tx: Tx, cuenta: { id: string; pedidoId: string | null }) {
  if (cuenta.pedidoId) return bloquearPedido(tx, cuenta.pedidoId);
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-cuenta-pagar:${cuenta.id}`}))`;
}

// --- Crear desde los costos -------------------------------------------------------------------

export type DatosCuentasDelPedido = {
  workspaceId: string;
  pedidoId: string;
  /** Los ítems guardados del pedido (`items` de la instantánea). */
  items: unknown;
  /** "aaaa-mm-dd" o el `Date` de la columna `eventDate` (`@db.Date`); null sin fecha. */
  fechaEvento: string | Date | null;
  createdByUserId: number | null;
};

/**
 * Crea las cuentas a pagar de un pedido desde los costos-plantilla de su catálogo, dentro de la
 * transacción de quien llama. Lee los costos y los combos sólo del workspace. Un proveedor que ya
 * no es un contacto del workspace queda vacío. Devuelve cuántas creó.
 */
export async function crearCuentasDelPedido(tx: Tx, d: DatosCuentasDelPedido): Promise<number> {
  const { workspaceId } = d;
  const items: ItemParaCostos[] = itemsGuardados(d.items).map((i) => ({ productId: i.productId, cantidad: i.cantidad, opcional: i.opcional, nombre: i.nombre }));
  const raiz = [...new Set(items.filter((i) => !i.opcional && typeof i.productId === "string" && i.productId).map((i) => i.productId as string))];
  if (raiz.length === 0) return 0;

  // Los componentes de los combos, nivel por nivel (un combo puede tener otro combo adentro).
  const vistos = new Set(raiz);
  const combos: { comboProductId: string; componentProductId: string; quantity: number }[] = [];
  let frontera = raiz;
  for (let nivel = 0; nivel < PROFUNDIDAD_COMBOS && frontera.length > 0; nivel++) {
    const filas = await tx.fotofficeComboItem.findMany({
      where: { workspaceId, comboProductId: { in: frontera } },
      orderBy: [{ order: "asc" }],
      select: { comboProductId: true, componentProductId: true, quantity: true },
    });
    combos.push(...filas);
    frontera = [...new Set(filas.map((f) => f.componentProductId).filter((id) => !vistos.has(id)))];
    for (const id of frontera) vistos.add(id);
  }

  const costos = await tx.fotofficeCostoPlantilla.findMany({
    where: { workspaceId, productId: { in: [...vistos] } },
    orderBy: [{ order: "asc" }],
    select: { id: true, productId: true, supplierClientId: true, concept: true, amountArs: true, perUnit: true, daysFromEvent: true },
  });
  if (costos.length === 0) return 0;

  // Los nombres de los componentes, para el concepto ("Impresión · Álbum 30×30"). Los ítems usan
  // el nombre con el que se vendieron.
  const componentes = [...vistos].filter((id) => !raiz.includes(id));
  const productos = componentes.length
    ? await tx.product.findMany({ where: { workspaceId, id: { in: componentes } }, select: { id: true, name: true } })
    : [];
  const nombres = new Map(productos.map((p) => [p.id, p.name]));

  const cuentas = cuentasDesdeCostos({ items, costos, combos, fechaEvento: d.fechaEvento, nombres });
  if (cuentas.length === 0) return 0;

  const proveedores = [...new Set(cuentas.map((c) => c.supplierClientId).filter((x): x is string => !!x))];
  const propios = proveedores.length
    ? new Set((await tx.client.findMany({ where: { workspaceId, id: { in: proveedores } }, select: { id: true } })).map((c) => c.id))
    : new Set<string>();

  const r = await tx.fotofficeCuentaPagar.createMany({
    data: cuentas.slice(0, MAX_CUENTAS_POR_PEDIDO).map((c) => ({
      workspaceId,
      pedidoId: d.pedidoId,
      supplierClientId: c.supplierClientId && propios.has(c.supplierClientId) ? c.supplierClientId : null,
      costoPlantillaId: c.costoPlantillaId,
      concept: c.concept.slice(0, MAX_CONCEPTO_CUENTA),
      amountArs: pesosParaBase(c.amountArs),
      dueDate: c.dueDate ? fechaParaBase(c.dueDate) : null,
      costCategoryId: null,
      createdByUserId: d.createdByUserId,
    })),
  });
  return r.count;
}

/**
 * "Generar costos" en la ficha: para los pedidos sin ninguna cuenta a pagar. Idempotente: si el
 * pedido ya tiene alguna (de cualquier estado), no hace nada y lo dice.
 */
export async function generarCostosDelPedido(ctx: CtxPedidos, pedidoId: unknown): Promise<ResultadoGenerar> {
  if (!puedeGestionarCuentas(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(pedidoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoGenerar> => {
      await bloquearPedido(tx, pedidoId);
      const p = await tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, status: true, items: true, eventDate: true } });
      if (!p) throw new Corte(MENSAJES_PEDIDO.noExiste);
      if (p.status === "CANCELADO") throw new Corte(MENSAJES_CUENTA.cancelado);
      const ya = await tx.fotofficeCuentaPagar.count({ where: { workspaceId, pedidoId: p.id } });
      if (ya > 0) return { ok: true, creadas: 0, mensaje: MENSAJES_CUENTA.yaTieneCostos };
      const creadas = await crearCuentasDelPedido(tx, {
        workspaceId, pedidoId: p.id, items: p.items, fechaEvento: p.eventDate, createdByUserId: ctx.userId,
      });
      return { ok: true, creadas, mensaje: creadas === 0 ? MENSAJES_CUENTA.sinCostos : null };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    falla("generarCostosDelPedido", e);
    return { ok: false, error: MENSAJES_CUENTA.fallo };
  }
}

// --- Agregar, editar y borrar -----------------------------------------------------------------

export type DatosCuenta = {
  /** Sin id: una cuenta nueva del pedido `pedidoId`. Con id: editar esa cuenta. */
  id?: unknown;
  pedidoId?: unknown;
  supplierClientId?: unknown;
  concepto: unknown;
  /** Pesos, con hasta dos decimales. */
  importe: unknown;
  /** "aaaa-mm-dd" o null (sin vencimiento). */
  vence?: unknown;
  /** Rubro de costo (EGRESO de Caja) o null: se puede elegir al pagar. */
  costCategoryId?: unknown;
};

type CuentaValidada = {
  id: string | null;
  pedidoId: string | null;
  supplierClientId: string | null;
  concepto: string;
  importe: number;
  vence: string | null;
  costCategoryId: string | null;
};

function opcional(v: unknown): unknown {
  return v === undefined || v === null || v === "" ? null : v;
}

function validarCuenta(d: DatosCuenta): { ok: true; v: CuentaValidada } | { ok: false; error: string } {
  if (!d || typeof d !== "object") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const id = opcional(d.id);
  if (id !== null && !idValido(id)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const pedidoId = opcional(d.pedidoId);
  if (pedidoId !== null && !idValido(pedidoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  // Una cuenta nueva siempre es de un pedido (las sueltas no se cargan desde acá).
  if (id === null && pedidoId === null) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const proveedor = opcional(d.supplierClientId);
  if (proveedor !== null && !idValido(proveedor)) return { ok: false, error: MENSAJES_CUENTA.proveedor };
  if (typeof d.concepto !== "string") return { ok: false, error: MENSAJES_CUENTA.concepto };
  const concepto = d.concepto.trim();
  if (concepto === "" || concepto.length > MAX_CONCEPTO_CUENTA) return { ok: false, error: MENSAJES_CUENTA.concepto };
  const importe = d.importe;
  if (typeof importe !== "number" || !tieneHastaDosDecimales(importe) || aCentavos(importe) <= 0) return { ok: false, error: MENSAJES_CUENTA.importe };
  if (importe > MAX_IMPORTE_CUENTA) return { ok: false, error: MENSAJES_CUENTA.importeTope };
  const vence = opcional(d.vence);
  if (vence !== null && !esFechaValida(vence)) return { ok: false, error: MENSAJES_CUENTA.vencimiento };
  const rubro = opcional(d.costCategoryId);
  if (rubro !== null && !idValido(rubro)) return { ok: false, error: MENSAJES_CUENTA.rubro };
  return {
    ok: true,
    v: {
      id: id as string | null,
      pedidoId: pedidoId as string | null,
      supplierClientId: proveedor as string | null,
      concepto,
      importe: desdeCentavos(aCentavos(importe)),
      vence: vence as string | null,
      costCategoryId: rubro as string | null,
    },
  };
}

/** Un rubro EGRESO del workspace (activo, o el que la cuenta ya tenía). */
async function rubroDeCosto(tx: Pick<Tx, "cashCategory">, workspaceId: string, id: string, actual: string | null = null) {
  return tx.cashCategory.findFirst({
    where: { id, workspaceId, kind: "EGRESO", ...(id === actual ? {} : { isActive: true }) },
    select: { id: true },
  });
}

/** Agrega una cuenta a un pedido, o edita una pendiente. Con "Gestionar" y ver costos. */
export async function guardarCuenta(ctx: CtxPedidos, datos: DatosCuenta): Promise<ResultadoCuenta> {
  if (!puedeGestionarCuentas(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  const val = validarCuenta(datos);
  if (!val.ok) return val;
  const v = val.v;
  const { workspaceId } = ctx;

  // Qué pedido bloquear: el de la cuenta que se edita, o el elegido para una nueva.
  let pedidoId = v.pedidoId;
  if (v.id) {
    const c0 = await prisma.fotofficeCuentaPagar.findFirst({ where: { id: v.id, workspaceId }, select: { id: true, pedidoId: true } });
    if (!c0) return { ok: false, error: MENSAJES_CUENTA.noExiste };
    pedidoId = c0.pedidoId;
  }

  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoCuenta> => {
      if (v.id) await bloquearCuenta(tx, { id: v.id, pedidoId });
      else await bloquearPedido(tx, pedidoId!);

      let rubroActual: string | null = null;
      if (v.id) {
        const c = await tx.fotofficeCuentaPagar.findFirst({ where: { id: v.id, workspaceId }, select: { id: true, paidAt: true, costCategoryId: true } });
        if (!c) throw new Corte(MENSAJES_CUENTA.noExiste);
        if (c.paidAt) throw new Corte(MENSAJES_CUENTA.pagada);
        rubroActual = c.costCategoryId;
      } else {
        const p = await tx.fotofficePedido.findFirst({ where: { id: pedidoId!, workspaceId }, select: { id: true, status: true } });
        if (!p) throw new Corte(MENSAJES_PEDIDO.noExiste);
        if (p.status === "CANCELADO") throw new Corte(MENSAJES_CUENTA.cancelado);
        const n = await tx.fotofficeCuentaPagar.count({ where: { workspaceId, pedidoId: p.id } });
        if (n >= MAX_CUENTAS_POR_PEDIDO) throw new Corte(MENSAJES_CUENTA.tope);
      }
      if (v.supplierClientId) {
        const s = await tx.client.findFirst({ where: { id: v.supplierClientId, workspaceId }, select: { id: true } });
        if (!s) throw new Corte(MENSAJES_CUENTA.proveedor);
      }
      if (v.costCategoryId && !(await rubroDeCosto(tx, workspaceId, v.costCategoryId, rubroActual))) throw new Corte(MENSAJES_CUENTA.rubro);

      const data = {
        supplierClientId: v.supplierClientId,
        concept: v.concepto,
        amountArs: pesosParaBase(v.importe),
        dueDate: v.vence ? fechaParaBase(v.vence) : null,
        costCategoryId: v.costCategoryId,
      };
      if (v.id) {
        const r = await tx.fotofficeCuentaPagar.updateMany({ where: { id: v.id, workspaceId, paidAt: null }, data });
        if (r.count !== 1) throw new Corte(MENSAJES_CUENTA.pagada);
        return { ok: true, cuentaId: v.id, pedidoId };
      }
      const creada = await tx.fotofficeCuentaPagar.create({
        data: { ...data, workspaceId, pedidoId: pedidoId!, createdByUserId: ctx.userId },
        select: { id: true },
      });
      return { ok: true, cuentaId: creada.id, pedidoId };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    falla("guardarCuenta", e);
    return { ok: false, error: MENSAJES_CUENTA.fallo };
  }
}

/** Borra una cuenta que no está pagada. Con "Gestionar" y ver costos. */
export async function borrarCuenta(ctx: CtxPedidos, cuentaId: unknown): Promise<ResultadoCuenta> {
  if (!puedeGestionarCuentas(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(cuentaId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const { workspaceId } = ctx;
  const c0 = await prisma.fotofficeCuentaPagar.findFirst({ where: { id: cuentaId, workspaceId }, select: { id: true, pedidoId: true } });
  if (!c0) return { ok: false, error: MENSAJES_CUENTA.noExiste };
  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoCuenta> => {
      await bloquearCuenta(tx, c0);
      const r = await tx.fotofficeCuentaPagar.deleteMany({ where: { id: c0.id, workspaceId, paidAt: null } });
      if (r.count !== 1) {
        const sigue = await tx.fotofficeCuentaPagar.findFirst({ where: { id: c0.id, workspaceId }, select: { id: true } });
        throw new Corte(sigue ? MENSAJES_CUENTA.pagada : MENSAJES_CUENTA.noExiste);
      }
      return { ok: true, cuentaId: c0.id, pedidoId: c0.pedidoId };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    falla("borrarCuenta", e);
    return { ok: false, error: MENSAJES_CUENTA.fallo };
  }
}

// --- Pagar y anular ---------------------------------------------------------------------------

export type DatosPago = {
  cuentaId: unknown;
  /** Día del pago en Argentina, "aaaa-mm-dd". */
  fecha: unknown;
  medio: unknown;
  /** Rubro de costo (EGRESO de Caja). Obligatorio. */
  categoryId: unknown;
  /** Clave única del formulario (8 a 100 caracteres: letras, números, `-` o `_`). */
  idempotencyKey: unknown;
};

type PagoValidado = { cuentaId: string; fecha: string; medio: MedioCobro; categoryId: string; clave: string };

function validarPago(d: DatosPago, ahora: Date): { ok: true; v: PagoValidado } | { ok: false; error: string } {
  if (!d || typeof d !== "object" || !idValido(d.cuentaId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  if (typeof d.idempotencyKey !== "string" || !CLAVE_IDEMPOTENCIA.test(d.idempotencyKey)) return { ok: false, error: MENSAJES_CUENTA.clave };
  if (!esFechaValida(d.fecha)) return { ok: false, error: MENSAJES_CUENTA.fecha };
  if (d.fecha > diaEnBuenosAires(ahora)) return { ok: false, error: MENSAJES_CUENTA.fechaFutura };
  if (!esMedioCobro(d.medio)) return { ok: false, error: MENSAJES_CUENTA.medio };
  if (!idValido(d.categoryId)) return { ok: false, error: MENSAJES_CUENTA.rubro };
  return { ok: true, v: { cuentaId: d.cuentaId, fecha: d.fecha, medio: d.medio, categoryId: d.categoryId, clave: d.idempotencyKey } };
}

type CuentaPorClave = { id: string; pedidoId: string | null; paidAt: Date | null; paidCashMovementId: string | null };

function porClave(cliente: Pick<Tx, "fotofficeCuentaPagar">, workspaceId: string, clave: string): Promise<CuentaPorClave | null> {
  return cliente.fotofficeCuentaPagar.findFirst({
    where: { workspaceId, idempotencyKey: clave },
    select: { id: true, pedidoId: true, paidAt: true, paidCashMovementId: true },
  });
}

/** La misma clave otra vez: el pago que ya estaba (o un rechazo si la clave es de otra cuenta o de un pago anulado). */
function repetido(c: CuentaPorClave, cuentaId: string): ResultadoPago {
  if (c.id !== cuentaId) return { ok: false, error: MENSAJES_CUENTA.claveDeOtra };
  if (!c.paidAt) return { ok: false, error: MENSAJES_CUENTA.claveUsada };
  return { ok: true, cuentaId: c.id, pedidoId: c.pedidoId, creado: false, movimientoId: c.paidCashMovementId };
}

class Repetido extends Error {
  constructor(readonly cuenta: CuentaPorClave) {
    super("repetido");
  }
}

/** Paga una cuenta. Ver el comentario del archivo. Con "Gestionar" y ver costos. */
export async function pagarCuenta(ctx: CtxPedidos, datos: DatosPago, deps: DepsCuentas = {}): Promise<ResultadoPago> {
  if (!puedeGestionarCuentas(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  const ahora = (deps.ahora ?? (() => new Date()))();
  const val = validarPago(datos, ahora);
  if (!val.ok) return val;
  const v = val.v;
  const { workspaceId } = ctx;

  const previo = await porClave(prisma, workspaceId, v.clave);
  if (previo) return repetido(previo, v.cuentaId);
  if (!(await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY))) return { ok: false, error: MENSAJES_CUENTA.sinCaja };
  const c0 = await prisma.fotofficeCuentaPagar.findFirst({ where: { id: v.cuentaId, workspaceId }, select: { id: true, pedidoId: true } });
  if (!c0) return { ok: false, error: MENSAJES_CUENTA.noExiste };

  const paidAt = instanteDelPago(v.fecha, ahora);
  try {
    const movimientoId = await prisma.$transaction(async (tx): Promise<string> => {
      await bloquearCuenta(tx, c0);
      const yaEstaba = await porClave(tx, workspaceId, v.clave);
      if (yaEstaba) throw new Repetido(yaEstaba);

      const c = await tx.fotofficeCuentaPagar.findFirst({
        where: { id: c0.id, workspaceId },
        select: { id: true, pedidoId: true, supplierClientId: true, concept: true, amountArs: true, paidAt: true, costCategoryId: true },
      });
      if (!c) throw new Corte(MENSAJES_CUENTA.noExiste);
      if (c.paidAt) throw new Corte(MENSAJES_CUENTA.yaPagada);
      const centavos = decimalArsToMinor(c.amountArs);
      if (centavos <= 0) throw new Corte(MENSAJES_CUENTA.importe);

      const rubro = await rubroDeCosto(tx, workspaceId, v.categoryId, c.costCategoryId);
      if (!rubro) throw new Corte(MENSAJES_CUENTA.rubro);
      // El proveedor, sólo si sigue siendo un contacto del workspace.
      const proveedor = c.supplierClientId
        ? await tx.client.findFirst({ where: { id: c.supplierClientId, workspaceId }, select: { id: true } })
        : null;
      const pedido = c.pedidoId ? await tx.fotofficePedido.findFirst({ where: { id: c.pedidoId, workspaceId }, select: { number: true } }) : null;

      // De dónde sale en Caja. Nunca inventa una cuenta: sin cuenta, no hay pago.
      const cuentasCaja = await tx.cashAccount.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, kind: true, isDefault: true, isVault: true },
        orderBy: { order: "asc" },
      });
      const destino = resolveDepositTarget({ cashEnabled: true, paymentMethod: v.medio, accounts: cuentasCaja, categories: [], categoryName: "" });
      if (!destino.ok) throw new Corte(MENSAJES_CUENTA.sinCuenta);

      // `(sourceModule, sourceRef)` es único: el primer pago lleva el id de la cuenta; uno nuevo
      // después de anular el anterior, el id con la clave del formulario.
      const anterior = await tx.cashMovement.findFirst({ where: { sourceModule: MODULO_CAJA_PAGOS, sourceRef: c.id }, select: { id: true } });
      const sourceRef = anterior ? `${c.id}:${v.clave}` : c.id;
      const descripcion = `Pago a proveedor${pedido ? ` · pedido N° ${pedido.number}` : ""} · ${c.concept}`.slice(0, 300);
      const mov = await recordCashMovement(tx, {
        workspaceId,
        accountId: destino.accountId,
        kind: "EGRESO",
        amountMinor: centavos,
        occurredAt: paidAt,
        description: descripcion,
        sourceModule: MODULO_CAJA_PAGOS,
        sourceRef,
        categoryId: rubro.id,
        clientId: proveedor?.id ?? null,
        paymentMethod: v.medio,
        createdByUserId: ctx.userId,
      });
      // Nunca se engancha a un egreso que ya existía (sería de otro pago).
      if (!mov.created) throw new Error("egreso repetido");

      const r = await tx.fotofficeCuentaPagar.updateMany({
        where: { id: c.id, workspaceId, paidAt: null },
        data: {
          paidAt,
          paidMethod: v.medio,
          paidCashMovementId: mov.id,
          costCategoryId: rubro.id,
          idempotencyKey: v.clave,
          voidedAt: null,
          voidReason: null,
          voidCashMovementId: null,
        },
      });
      if (r.count !== 1) throw new Corte(MENSAJES_CUENTA.yaPagada);
      return mov.id;
    }, OPCIONES_TRANSACCION);
    return { ok: true, cuentaId: c0.id, pedidoId: c0.pedidoId, creado: true, movimientoId };
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    if (e instanceof Repetido) return repetido(e.cuenta, v.cuentaId);
    // Otra pestaña con la misma clave pagó en el medio (el único de la clave frena): ese pago.
    if (codigoDe(e) === "P2002") {
      const otro = await porClave(prisma, workspaceId, v.clave).catch(() => null);
      if (otro) return repetido(otro, v.cuentaId);
    }
    falla("pagarCuenta", e);
    return { ok: false, error: MENSAJES_CUENTA.falloPago };
  }
}

/**
 * Anula el pago de una cuenta con su motivo: contramovimiento en Caja y la cuenta vuelve a
 * pendiente. Si alguien ya anuló el egreso a mano desde Caja, usa esa anulación. Una segunda
 * anulación no hace nada. Con "Gestionar" y ver costos.
 */
export async function anularPagoCuenta(ctx: CtxPedidos, cuentaId: unknown, motivo: unknown, deps: DepsCuentas = {}): Promise<ResultadoAnularPago> {
  if (!puedeGestionarCuentas(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(cuentaId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  if (typeof motivo !== "string" || motivo.trim() === "") return { ok: false, error: MENSAJES_CUENTA.motivo };
  const razon = motivo.trim();
  if (razon.length > MAX_MOTIVO_ANULACION) return { ok: false, error: MENSAJES_CUENTA.motivoLargo };
  const { workspaceId } = ctx;
  const ahora = (deps.ahora ?? (() => new Date()))();

  const c0 = await prisma.fotofficeCuentaPagar.findFirst({ where: { id: cuentaId, workspaceId }, select: { id: true, pedidoId: true, paidAt: true, voidedAt: true } });
  if (!c0) return { ok: false, error: MENSAJES_CUENTA.noExiste };
  if (!c0.paidAt) return c0.voidedAt ? { ok: true, yaAnulado: true, pedidoId: c0.pedidoId } : { ok: false, error: MENSAJES_CUENTA.noPagada };
  if (!(await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY))) return { ok: false, error: MENSAJES_CUENTA.sinCajaAnular };

  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoAnularPago> => {
      await bloquearCuenta(tx, c0);
      const c = await tx.fotofficeCuentaPagar.findFirst({ where: { id: c0.id, workspaceId }, select: { id: true, paidAt: true, paidCashMovementId: true } });
      if (!c) throw new Corte(MENSAJES_CUENTA.noExiste);
      // La segunda anulación (otra pestaña que ganó la carrera) no hace nada.
      if (!c.paidAt) return { ok: true, yaAnulado: true, pedidoId: c0.pedidoId };

      const voidCashMovementId = c.paidCashMovementId
        ? await contramovimiento(tx, workspaceId, c.paidCashMovementId, razon, ahora, ctx.userId)
        : null;
      const r = await tx.fotofficeCuentaPagar.updateMany({
        where: { id: c.id, workspaceId, paidAt: { not: null } },
        data: { paidAt: null, paidMethod: null, paidCashMovementId: null, voidedAt: ahora, voidReason: razon, voidCashMovementId },
      });
      if (r.count !== 1) return { ok: true, yaAnulado: true, pedidoId: c0.pedidoId };
      return { ok: true, yaAnulado: false, pedidoId: c0.pedidoId };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    falla("anularPagoCuenta", e);
    return { ok: false, error: MENSAJES_CUENTA.falloAnular };
  }
}

// --- Lecturas ---------------------------------------------------------------------------------

/** Una cuenta tal como la ve la ficha del pedido (sólo con `veCostosDePedido`). */
export type CuentaVista = {
  id: string;
  concepto: string;
  proveedorId: string | null;
  proveedor: string | null;
  importe: number;
  /** "aaaa-mm-dd" o null (sin vencimiento). */
  vence: string | null;
  estado: EstadoCuenta;
  rubroId: string | null;
  rubro: string | null;
  /** ISO del pago vigente. */
  pagadaEl: string | null;
  medio: string | null;
  /** ISO de la última anulación de un pago (la cuenta volvió a pendiente). */
  pagoAnuladoEl: string | null;
  motivoAnulacion: string | null;
};

export type CostosYPagos = { cuentas: CuentaVista[]; margenes: Margenes };

/**
 * Las cuentas a pagar del pedido con sus márgenes. Sin `veCostosDePedido` devuelve null sin leer
 * nada. `total` y `cobrado` son los del plan del pedido (quien llama ya lo leyó en su workspace).
 */
export async function costosYPagosDelPedido(
  ctx: CtxPedidos,
  pedido: { id: string; total: number; cobrado: number },
  deps: DepsCuentas = {},
): Promise<CostosYPagos | null> {
  if (!puedeVerCuentas(ctx)) return null;
  const { workspaceId } = ctx;
  const hoy = diaEnBuenosAires((deps.ahora ?? (() => new Date()))());
  const filas = await prisma.fotofficeCuentaPagar.findMany({
    where: { workspaceId, pedidoId: pedido.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_CUENTAS_POR_PEDIDO,
    select: {
      id: true, concept: true, supplierClientId: true, amountArs: true, dueDate: true, costCategoryId: true,
      paidAt: true, paidMethod: true, voidedAt: true, voidReason: true,
    },
  });
  const proveedores = [...new Set(filas.map((f) => f.supplierClientId).filter((x): x is string => !!x))];
  const rubros = [...new Set(filas.map((f) => f.costCategoryId).filter((x): x is string => !!x))];
  const [contactos, categorias] = await Promise.all([
    proveedores.length
      ? prisma.client.findMany({ where: { workspaceId, id: { in: proveedores } }, select: { id: true, kind: true, firstName: true, lastName: true, businessName: true } })
      : Promise.resolve([]),
    rubros.length ? prisma.cashCategory.findMany({ where: { workspaceId, id: { in: rubros } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const nombre = new Map(contactos.map((c) => [c.id, clientDisplayName(c)]));
  const rubro = new Map(categorias.map((c) => [c.id, c.name]));
  const cuentas = filas.map((f): CuentaVista => {
    const vence = f.dueDate ? fechaDeBase(f.dueDate) : null;
    const proveedorId = f.supplierClientId && nombre.has(f.supplierClientId) ? f.supplierClientId : null;
    const rubroId = f.costCategoryId && rubro.has(f.costCategoryId) ? f.costCategoryId : null;
    return {
      id: f.id,
      concepto: f.concept,
      proveedorId,
      proveedor: proveedorId ? nombre.get(proveedorId)! : null,
      importe: pesosDeBase(f.amountArs),
      vence,
      estado: estadoDeCuenta({ pagada: f.paidAt !== null, vence }, hoy),
      rubroId,
      rubro: rubroId ? rubro.get(rubroId)! : null,
      pagadaEl: f.paidAt ? f.paidAt.toISOString() : null,
      medio: f.paidAt ? f.paidMethod : null,
      pagoAnuladoEl: !f.paidAt && f.voidedAt ? f.voidedAt.toISOString() : null,
      motivoAnulacion: !f.paidAt && f.voidedAt ? f.voidReason : null,
    };
  });
  return {
    cuentas,
    margenes: margenesDelPedido({ total: pedido.total, cobrado: pedido.cobrado, cuentas: cuentas.map((c) => ({ importe: c.importe, pagada: c.estado === "PAGADA" })) }),
  };
}

export type OpcionProveedor = { id: string; nombre: string; esProveedor: boolean };

/** Tope de contactos que se ofrecen además de los de categoría Proveedor. */
const TOPE_OTROS_CONTACTOS = 500;

/**
 * Contactos para elegir el proveedor: primero los de categoría Proveedor (como el editor de costos
 * del catálogo), después el resto del workspace por nombre, más los ya usados en `incluir`.
 */
export async function proveedoresParaCuentas(workspaceId: string, incluir: readonly string[] = []): Promise<OpcionProveedor[]> {
  const proveedores = await proveedoresDelWorkspace(workspaceId);
  const ya = new Set(proveedores.map((p) => p.id));
  const otros = (
    await prisma.client.findMany({
      where: { workspaceId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { businessName: "asc" }, { id: "asc" }],
      take: TOPE_OTROS_CONTACTOS + ya.size,
      select: { id: true, kind: true, firstName: true, lastName: true, businessName: true },
    })
  )
    .filter((c) => !ya.has(c.id))
    .slice(0, TOPE_OTROS_CONTACTOS);
  for (const o of otros) ya.add(o.id);
  const faltan = incluir.filter((id) => idValido(id) && !ya.has(id));
  const extra = faltan.length
    ? await prisma.client.findMany({ where: { workspaceId, id: { in: faltan } }, select: { id: true, kind: true, firstName: true, lastName: true, businessName: true } })
    : [];
  return [
    ...proveedores.map((p) => ({ id: p.id, nombre: p.name, esProveedor: true })),
    ...[...otros, ...extra]
      .map((c) => ({ id: c.id, nombre: clientDisplayName(c), esProveedor: false }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  ];
}

/** Rubros de costo (EGRESO) activos del workspace, más los ya usados en `incluir` aunque estén inactivos. */
export async function rubrosDeCosto(workspaceId: string, incluir: readonly string[] = []): Promise<{ id: string; nombre: string }[]> {
  const usados = incluir.filter(idValido);
  const filas = await prisma.cashCategory.findMany({
    where: { workspaceId, kind: "EGRESO", OR: [{ isActive: true }, ...(usados.length ? [{ id: { in: usados } }] : [])] },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
    take: 500,
  });
  return filas.map((f) => ({ id: f.id, nombre: f.name }));
}
