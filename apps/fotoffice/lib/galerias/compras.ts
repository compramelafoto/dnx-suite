import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { CASH_MODULE_KEY, type PaymentMethod } from "@/lib/cash/constants";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { decimalArsToMinor } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { esFechaValida } from "@/lib/pedidos/plan-cuotas";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { MENSAJES_GALERIA as M, puedeGestionarGalerias, puedeVerGalerias, type CtxGalerias } from "./acceso";
import { esEstadoCompra, type EstadoCompra } from "./compras-reglas";
import { registrarEvento } from "./eventos";
import { ETIQUETA_MEDIO_COMPRA } from "./medios";
import { calcularCarrito, centavosAArs, type Carrito, type ConfigVenta } from "./precios";
import { SELECT_CONFIG_VENTA, configVentaDeFila, puedeVerVentasGalerias } from "./venta";

/**
 * Compras de fotos extra (etapa 7, Entrega A2): registrar una compra PAGADA (a mano desde la revisión del
 * cliente o, en la Entrega A2 · Tarea 3, al acreditar Mercado Pago) y leer las compras de un cliente.
 *
 * **`registrarCompraPagada` es la única puerta por donde una compra pasa a PAGADA.** En una sola transacción:
 *   1. la escritura condicional `PENDIENTE → PAGADA` (de dos pedidos a la vez gana uno; el otro encuentra la
 *      compra ya pagada y devuelve `yaEstabaPagada: true` sin repetir nada);
 *   2. guarda `paidAt`, el pago del proveedor (si lo hay) y la comisión y el neto;
 *   3. con Caja encendida y una cuenta donde depositar, el INGRESO en Caja (`sourceModule` "galerias",
 *      `sourceRef` = id de la compra, rubro de la galería o el de Configuración → Galería, contacto del
 *      cliente) y lo ata a la compra. Sin Caja (apagada o sin cuenta) la compra queda PAGADA igual: el cliente
 *      ya pagó. Se anota el evento `COMPRA_SIN_CAJA` para que el estudio lo vea y lo cargue a mano;
 *   4. en una galería "Sólo venta", la compra pagada es el final: el cliente pasa a EN_REVISION;
 *   5. los eventos del historial (códigos y números, nunca datos personales).
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const idValido = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v);
const no = (error: string) => ({ ok: false as const, error });

type Tx = Prisma.TransactionClient;

export const MENSAJES_COMPRA = {
  noExiste: "No encontramos esa compra.",
  cancelada: "La compra está cancelada: armá una nueva.",
  sinExtras: "Este cliente no tiene fotos extra para cobrar.",
  sinVenta: "Esta galería no vende fotos extra: configurá la venta en la pestaña Venta.",
  metodo: "Elegí cómo pagó: efectivo, transferencia u otro.",
  fecha: "La fecha del pago no es válida.",
  fechaFutura: "La fecha del pago no puede ser posterior a hoy.",
  cuenta: "La cuenta de Caja elegida no es válida.",
  pagoRepetido: "Ese pago ya se usó en otra compra.",
  fallo: "No se pudo registrar el pago. Probá de nuevo.",
} as const;

export { ETIQUETA_MEDIO_COMPRA };
export const MEDIOS_A_MANO = ["EFECTIVO", "TRANSFERENCIA", "OTRO"] as const satisfies readonly PaymentMethod[];
export type MedioAMano = (typeof MEDIOS_A_MANO)[number];

/** Instante del pago: hoy, ahora; un día anterior, ese día a las 12 de Argentina (cae en ese día en cualquier reporte). */
export function instanteDelPagoCompra(fecha: string, ahora: Date): Date {
  return fecha === diaEnBuenosAires(ahora) ? ahora : new Date(`${fecha}T12:00:00.000-03:00`);
}

class Corte extends Error {
  constructor(readonly mensaje: string, readonly codigo: string) {
    super("corte");
  }
}

// --- Registrar una compra pagada (compartida por "Marcar pagada a mano" y Mercado Pago) ---------------------

export type PagoCompra = {
  workspaceId: string;
  compraId: string;
  /** Instante del pago. */
  paidAt: Date;
  /** Medio del pago: "MERCADO_PAGO" al acreditar, o el que eligió el estudio a mano. */
  medio: PaymentMethod;
  /** Pago del proveedor (Mercado Pago): su id y la comisión y el neto en centavos (null si no se conocen). */
  proveedor?: { paymentRef: string; feeCents: number | null; netCents: number | null } | null;
  /** Usuario del estudio; null cuando lo hace el sistema (webhook o vuelta del comprador). */
  actorUserId: number | null;
  /** Cuenta de Caja elegida (sólo a mano). Sin esto, la del depósito automático según el medio. */
  cuentaId?: string | null;
  /** Una compra CANCELADA que el cliente igual pagó: acreditarla en lugar de rechazarla. */
  aceptarCancelada?: boolean;
};

export type MotivoSinCaja = "CAJA_APAGADA" | "SIN_CUENTA";

export type ResultadoPagoCompra =
  | {
      ok: true;
      /** true cuando la compra ya estaba PAGADA (repetición): no se hizo nada más. */
      yaEstabaPagada: boolean;
      compraId: string;
      galeriaId: string;
      galeriaClienteId: string;
      totalCents: number;
      extraCount: number;
      cashMovementId: string | null;
      sinCaja: boolean;
      motivoSinCaja: MotivoSinCaja | null;
    }
  | { ok: false; codigo: "NO_EXISTE" | "CANCELADA" | "CUENTA" | "PAGO_REPETIDO" | "ERROR"; error: string };

type DatosCompra = { id: string; galeriaId: string; galeriaClienteId: string; status: string; totalArs: { toString(): string }; extraCount: number; cashMovementId: string | null };

function yaPagada(c: DatosCompra, totalCents: number): ResultadoPagoCompra {
  return {
    ok: true, yaEstabaPagada: true, compraId: c.id, galeriaId: c.galeriaId, galeriaClienteId: c.galeriaClienteId, totalCents,
    extraCount: c.extraCount, cashMovementId: c.cashMovementId, sinCaja: c.cashMovementId === null, motivoSinCaja: null,
  };
}

/**
 * El núcleo, dentro de una transacción ya abierta (lo usan `registrarCompraPagada` y "Marcar pagada a mano",
 * que crea la compra y la paga en la misma transacción). `cajaEncendida` se lee afuera de la transacción.
 */
export async function acreditarCompraEnTx(tx: Tx, p: PagoCompra, cajaEncendida: boolean): Promise<ResultadoPagoCompra> {
  const { workspaceId, compraId } = p;
  const antes = await tx.fotofficeGaleriaCompra.findFirst({
    where: { id: compraId, workspaceId },
    select: { id: true, galeriaId: true, galeriaClienteId: true, status: true, totalArs: true, extraCount: true, cashMovementId: true },
  });
  if (!antes) return { ok: false, codigo: "NO_EXISTE", error: MENSAJES_COMPRA.noExiste };
  const totalCents = decimalArsToMinor(antes.totalArs);
  if (antes.status === "PAGADA") return yaPagada(antes, totalCents);
  if (antes.status === "CANCELADA" && !p.aceptarCancelada) return { ok: false, codigo: "CANCELADA", error: MENSAJES_COMPRA.cancelada };

  const desde: EstadoCompra[] = p.aceptarCancelada ? ["PENDIENTE", "CANCELADA"] : ["PENDIENTE"];
  const proveedor = p.proveedor ?? null;
  const r = await tx.fotofficeGaleriaCompra.updateMany({
    where: { id: compraId, workspaceId, status: { in: desde } },
    data: {
      status: "PAGADA",
      paidAt: p.paidAt,
      providerPaymentRef: proveedor?.paymentRef ?? null,
      feeArs: proveedor?.feeCents == null ? null : centavosAArs(proveedor.feeCents),
      netArs: proveedor?.netCents == null ? null : centavosAArs(proveedor.netCents),
    },
  });
  if (r.count !== 1) {
    // Otra corrida la acreditó entre la lectura y la escritura: la que ganó ya hizo todo.
    const ahora = await tx.fotofficeGaleriaCompra.findFirst({
      where: { id: compraId, workspaceId },
      select: { id: true, galeriaId: true, galeriaClienteId: true, status: true, totalArs: true, extraCount: true, cashMovementId: true },
    });
    if (ahora?.status === "PAGADA") return yaPagada(ahora, totalCents);
    return { ok: false, codigo: "CANCELADA", error: MENSAJES_COMPRA.cancelada };
  }

  const [galeria, cliente, ajustes] = await Promise.all([
    tx.fotofficeGaleria.findFirst({ where: { id: antes.galeriaId, workspaceId }, select: { id: true, saleMode: true, incomeCategoryId: true } }),
    tx.fotofficeGaleriaCliente.findFirst({ where: { id: antes.galeriaClienteId, workspaceId }, select: { id: true, clientId: true } }),
    tx.fotofficeGaleriaAjustes.findFirst({ where: { workspaceId }, select: { defaultIncomeCategoryId: true } }),
  ]);

  // Caja. Nunca inventa una cuenta: sin cuenta no hay movimiento, pero el pago no se pierde.
  let cashMovementId: string | null = null;
  let motivoSinCaja: MotivoSinCaja | null = null;
  if (!cajaEncendida) {
    motivoSinCaja = "CAJA_APAGADA";
  } else {
    let cuentaId: string | null = null;
    if (p.cuentaId) {
      const elegida = await tx.cashAccount.findFirst({ where: { id: p.cuentaId, workspaceId, isActive: true, isVault: false }, select: { id: true } });
      if (!elegida) throw new Corte(MENSAJES_COMPRA.cuenta, "CUENTA");
      cuentaId = elegida.id;
    } else {
      const cuentas = await tx.cashAccount.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, kind: true, isDefault: true, isVault: true },
        orderBy: { order: "asc" },
      });
      const destino = resolveDepositTarget({ cashEnabled: true, paymentMethod: p.medio, accounts: cuentas, categories: [], categoryName: "" });
      cuentaId = destino.ok ? destino.accountId : null;
    }
    if (cuentaId === null) {
      motivoSinCaja = "SIN_CUENTA";
    } else {
      const rubroId = galeria?.incomeCategoryId ?? ajustes?.defaultIncomeCategoryId ?? null;
      // El rubro tiene que seguir siendo un rubro de INGRESO del workspace (se pudo desactivar o borrar).
      const rubro = rubroId ? await tx.cashCategory.findFirst({ where: { id: rubroId, workspaceId, kind: "INGRESO" }, select: { id: true } }) : null;
      const mov = await recordCashMovement(tx, {
        workspaceId,
        accountId: cuentaId,
        kind: "INGRESO",
        amountMinor: totalCents,
        occurredAt: p.paidAt,
        description: `Fotos extra de galería · ${antes.extraCount} ${antes.extraCount === 1 ? "foto" : "fotos"}`,
        sourceModule: "galerias",
        sourceRef: compraId,
        categoryId: rubro?.id ?? null,
        clientId: cliente?.clientId ?? null,
        paymentMethod: p.medio,
        createdByUserId: p.actorUserId,
      });
      cashMovementId = mov.id;
      await tx.fotofficeGaleriaCompra.updateMany({ where: { id: compraId, workspaceId }, data: { cashMovementId: mov.id } });
    }
  }

  const base = { workspaceId, galeriaId: antes.galeriaId, galeriaClienteId: antes.galeriaClienteId, actorUserId: p.actorUserId };
  await registrarEvento(tx, {
    ...base, tipo: "COMPRA_PAGADA",
    data: { compraId, totalCents, fotos: antes.extraCount, medio: p.medio, via: proveedor ? "PROVEEDOR" : "MANUAL", enCaja: cashMovementId !== null },
  });
  if (motivoSinCaja) await registrarEvento(tx, { ...base, tipo: "COMPRA_SIN_CAJA", data: { compraId, totalCents, motivo: motivoSinCaja } });

  // "Sólo venta": la compra pagada es el final del recorrido del cliente.
  if (galeria?.saleMode === "VENTA") {
    const e = await tx.fotofficeGaleriaCliente.updateMany({
      where: { id: antes.galeriaClienteId, workspaceId, status: "EN_PROGRESO" },
      data: { status: "EN_REVISION", submittedAt: p.paidAt },
    });
    if (e.count === 1) await registrarEvento(tx, { ...base, tipo: "SELECCION_ENVIADA", data: { cantidad: antes.extraCount, via: "COMPRA" } });
  }

  return {
    ok: true, yaEstabaPagada: false, compraId, galeriaId: antes.galeriaId, galeriaClienteId: antes.galeriaClienteId, totalCents,
    extraCount: antes.extraCount, cashMovementId, sinCaja: cashMovementId === null, motivoSinCaja,
  };
}

function codigoDe(e: unknown): string | null {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : null;
}

/**
 * Pasa una compra existente a PAGADA (ver el comentario del archivo). Idempotente: repetirla devuelve
 * `yaEstabaPagada: true`. Sin permisos adentro: la llama código ya autorizado (la acción del estudio o, en la
 * Tarea 3, el webhook con el pago verificado). Todo acotado a `workspaceId`.
 */
export async function registrarCompraPagada(p: PagoCompra): Promise<ResultadoPagoCompra> {
  if (!idValido(p.workspaceId) || !idValido(p.compraId)) return { ok: false, codigo: "NO_EXISTE", error: MENSAJES_COMPRA.noExiste };
  const cajaEncendida = await isModuleEnabledForWorkspace(p.workspaceId, CASH_MODULE_KEY);
  try {
    return await prisma.$transaction((tx) => acreditarCompraEnTx(tx, p, cajaEncendida), OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, codigo: "CUENTA", error: e.mensaje };
    // El mismo pago de Mercado Pago ya está en otra compra (el único de `providerPaymentRef` frena).
    if (codigoDe(e) === "P2002") return { ok: false, codigo: "PAGO_REPETIDO", error: MENSAJES_COMPRA.pagoRepetido };
    console.error("[galerias] registrar una compra pagada falló", { codigo: codigoDe(e) });
    return { ok: false, codigo: "ERROR", error: MENSAJES_COMPRA.fallo };
  }
}

// --- Carrito de un cliente (lo que se cobraría ahora) ----------------------------------------------------------

/** La instantánea de precios que guarda cada compra: la configuración usada y lo que resultó. */
export function armarSnapshot(config: ConfigVenta, carrito: Carrito, origen: "MANUAL" | "MERCADO_PAGO"): Prisma.InputJsonValue {
  return {
    origen,
    saleMode: config.saleMode,
    includedCount: config.includedCount,
    pricingMode: config.pricingMode,
    unitPriceCents: config.unitPriceCents,
    packageSize: config.packageSize,
    packagePriceCents: config.packagePriceCents,
    discountMode: config.discountMode,
    discountPct: config.discountPct,
    discountRules: (config.discountRules ?? null) as Prisma.InputJsonValue,
    incluidas: carrito.incluidas.length,
    extras: carrito.extras.length,
    paquetes: carrito.paquetes,
    subtotalCents: carrito.subtotalCents,
    descuentoCents: carrito.descuentoCents,
    totalCents: carrito.totalCents,
    reglaAplicada: carrito.reglaAplicada ? { tipo: carrito.reglaAplicada.tipo, pct: carrito.reglaAplicada.pct, desde: carrito.reglaAplicada.desde } : null,
  } as Prisma.InputJsonValue;
}

type Cliente = Pick<Tx, "fotofficeGaleriaSeleccion" | "fotofficeGaleriaCompra" | "fotofficeGaleriaCompraFoto">;

/** Fotos ya pagadas por el cliente (compras PAGADAS). */
export async function fotosPagadasDeCliente(c: Cliente, workspaceId: string, galeriaClienteId: string): Promise<Set<string>> {
  const compras = await c.fotofficeGaleriaCompra.findMany({ where: { workspaceId, galeriaClienteId, status: "PAGADA" }, select: { id: true } });
  if (compras.length === 0) return new Set();
  const fotos = await c.fotofficeGaleriaCompraFoto.findMany({ where: { compraId: { in: compras.map((x) => x.id) } }, select: { fotoId: true } });
  return new Set(fotos.map((f) => f.fotoId));
}

/** El carrito de un cliente con lo que tiene elegido hoy y lo que ya pagó (el servidor es el único que calcula el precio). */
export async function carritoDeCliente(c: Cliente, workspaceId: string, galeriaClienteId: string, config: ConfigVenta): Promise<Carrito> {
  const [selecciones, pagadas] = await Promise.all([
    c.fotofficeGaleriaSeleccion.findMany({ where: { workspaceId, galeriaClienteId }, select: { id: true, fotoId: true, createdAt: true } }),
    fotosPagadasDeCliente(c, workspaceId, galeriaClienteId),
  ]);
  return calcularCarrito({ config, seleccion: selecciones.map((s) => ({ id: s.id, fotoId: s.fotoId, seleccionadaEn: s.createdAt })), pagadas });
}

// --- Marcar pagada a mano ------------------------------------------------------------------------------------

export type DatosPagoAMano = { metodo: unknown; fecha: unknown; cuentaId?: unknown };

export type ResultadoPagoAMano =
  | { ok: true; compraId: string; totalCents: number; extraCount: number; sinCaja: boolean; motivoSinCaja: MotivoSinCaja | null }
  | { ok: false; error: string };

/**
 * "Marcar pagada a mano" desde la revisión del cliente: arma una compra con las fotos extra que el cliente tiene
 * hoy (el precio lo calcula el servidor con `calcularCarrito`), la paga con el medio y la fecha indicados y la
 * registra en Caja si está encendida. Todo en una transacción con un candado por cliente: dos clics a la vez no
 * cobran las mismas fotos dos veces (el segundo ya no encuentra extras). Las compras PENDIENTES del cliente (un
 * Checkout Pro que quedó abierto) pasan a CANCELADAS: las fotos ya están pagadas. Con "Gestionar" en Galería.
 */
export async function marcarCompraPagadaAMano(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown, datos: unknown, ahora: Date = new Date()): Promise<ResultadoPagoAMano> {
  if (!puedeGestionarGalerias(ctx) || ctx.userId === null) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !idValido(galeriaClienteId) || !datos || typeof datos !== "object") return no(M.datosInvalidos);
  const d = datos as DatosPagoAMano;
  if (typeof d.metodo !== "string" || !(MEDIOS_A_MANO as readonly string[]).includes(d.metodo)) return no(MENSAJES_COMPRA.metodo);
  const medio = d.metodo as MedioAMano;
  if (!esFechaValida(d.fecha)) return no(MENSAJES_COMPRA.fecha);
  if (d.fecha > diaEnBuenosAires(ahora)) return no(MENSAJES_COMPRA.fechaFutura);
  let cuentaId: string | null = null;
  if (d.cuentaId !== undefined && d.cuentaId !== null && d.cuentaId !== "") {
    if (!idValido(d.cuentaId)) return no(MENSAJES_COMPRA.cuenta);
    cuentaId = d.cuentaId;
  }
  const { workspaceId } = ctx;
  const g = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { id: true, ...SELECT_CONFIG_VENTA } });
  if (!g) return no(M.noExiste);
  const cliente = await prisma.fotofficeGaleriaCliente.findFirst({ where: { id: galeriaClienteId, galeriaId, workspaceId }, select: { id: true } });
  if (!cliente) return no(M.clienteNoExiste);
  const config = configVentaDeFila(g);
  if (config.saleMode === "SELECCION") return no(MENSAJES_COMPRA.sinVenta);

  const cajaEncendida = await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY);
  const paidAt = instanteDelPagoCompra(d.fecha, ahora);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-galeria-cliente:${galeriaClienteId}`}))`;
      // Se vuelve a leer la configuración con el candado tomado: lo que se cobra es lo vigente ahora.
      const vigente = await tx.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { id: true, ...SELECT_CONFIG_VENTA } });
      if (!vigente) throw new Corte(M.noExiste, "NO_EXISTE");
      const cfg = configVentaDeFila(vigente);
      const carrito = await carritoDeCliente(tx, workspaceId, galeriaClienteId, cfg);
      if (cfg.saleMode === "SELECCION") throw new Corte(MENSAJES_COMPRA.sinVenta, "SIN_VENTA");
      if (carrito.extras.length < 1 || carrito.totalCents <= 0) throw new Corte(MENSAJES_COMPRA.sinExtras, "SIN_EXTRAS");

      const pendientes = await tx.fotofficeGaleriaCompra.findMany({ where: { workspaceId, galeriaClienteId, status: "PENDIENTE" }, select: { id: true } });
      if (pendientes.length > 0) {
        await tx.fotofficeGaleriaCompra.updateMany({ where: { workspaceId, galeriaClienteId, status: "PENDIENTE" }, data: { status: "CANCELADA" } });
        for (const p of pendientes) {
          await registrarEvento(tx, { workspaceId, galeriaId, galeriaClienteId, tipo: "COMPRA_CANCELADA", actorUserId: ctx.userId, data: { compraId: p.id, motivo: "PAGO_A_MANO" } });
        }
      }

      const compra = await tx.fotofficeGaleriaCompra.create({
        data: {
          workspaceId, galeriaId, galeriaClienteId, status: "PENDIENTE",
          extraCount: carrito.extras.length,
          subtotalArs: centavosAArs(carrito.subtotalCents),
          discountArs: centavosAArs(carrito.descuentoCents),
          totalArs: centavosAArs(carrito.totalCents),
          pricingSnapshot: armarSnapshot(cfg, carrito, "MANUAL"),
        },
        select: { id: true },
      });
      await tx.fotofficeGaleriaCompraFoto.createMany({ data: carrito.extras.map((fotoId) => ({ compraId: compra.id, fotoId })) });

      const r = await acreditarCompraEnTx(tx, { workspaceId, compraId: compra.id, paidAt, medio, actorUserId: ctx.userId, cuentaId }, cajaEncendida);
      if (!r.ok) throw new Corte(r.error, r.codigo);
      return { ok: true as const, compraId: compra.id, totalCents: r.totalCents, extraCount: r.extraCount, sinCaja: r.sinCaja, motivoSinCaja: r.motivoSinCaja };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    console.error("[galerias] marcar pagada a mano falló", { codigo: codigoDe(e) });
    return no(MENSAJES_COMPRA.fallo);
  }
}

// --- Lectura para la revisión del cliente ---------------------------------------------------------------------

export type CompraDeCliente = {
  id: string;
  estado: EstadoCompra;
  /** ISO: cuándo se pagó; si no se pagó, cuándo se armó. */
  fecha: string;
  fotos: number;
  totalCents: number;
  /** Comisión del proveedor; null si no hay o si no se puede ver el dinero. */
  feeCents: number | null;
  medio: string | null;
  proveedor: string | null;
  enCaja: boolean;
};

export type CuentaDeCaja = { id: string; nombre: string; esPorOmision: boolean };

export type ResumenVentaCliente = {
  /** La galería vende fotos extra (no es "Sólo selección"). */
  ventaActiva: boolean;
  compras: CompraDeCliente[];
  /** Lo que se cobraría hoy por las fotos extra que tiene elegidas (sin pagar). */
  ahora: { extras: number; incluidas: number; yaPagadas: number; subtotalCents: number; descuentoCents: number; totalCents: number };
  veDinero: boolean;
  cajaEncendida: boolean;
  cuentas: CuentaDeCaja[];
};

/**
 * Las compras de un cliente de la galería y el carrito de hoy, para la pantalla de revisión. Con "Ver" en
 * Galería; la comisión sólo con acceso al dinero. Acotado al workspace y a la galería.
 */
export async function cargarResumenVentaCliente(ctx: CtxGalerias, galeriaId: unknown, galeriaClienteId: unknown): Promise<ResumenVentaCliente | null> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId) || !idValido(galeriaClienteId)) return null;
  const { workspaceId } = ctx;
  const [g, cliente] = await Promise.all([
    prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { id: true, ...SELECT_CONFIG_VENTA } }),
    prisma.fotofficeGaleriaCliente.findFirst({ where: { id: galeriaClienteId, galeriaId, workspaceId }, select: { id: true } }),
  ]);
  if (!g || !cliente) return null;
  const config = configVentaDeFila(g);
  const veDinero = puedeVerVentasGalerias(ctx);
  const filas = await prisma.fotofficeGaleriaCompra.findMany({
    where: { workspaceId, galeriaId, galeriaClienteId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: { id: true, status: true, extraCount: true, totalArs: true, feeArs: true, paidAt: true, createdAt: true, providerPaymentRef: true, cashMovementId: true },
  });
  const pagos = filas.length
    ? await prisma.fotofficeGaleriaEvento.findMany({ where: { workspaceId, galeriaId, galeriaClienteId, type: "COMPRA_PAGADA" }, select: { data: true }, take: 500 })
    : [];
  const medioDe = new Map<string, string>();
  for (const e of pagos) {
    const dato = e.data as { compraId?: unknown; medio?: unknown } | null;
    if (dato && typeof dato.compraId === "string" && typeof dato.medio === "string") medioDe.set(dato.compraId, dato.medio);
  }
  const compras: CompraDeCliente[] = filas.map((f) => {
    const estado: EstadoCompra = esEstadoCompra(f.status) ? f.status : "PENDIENTE";
    const medio = estado === "PAGADA" ? (medioDe.get(f.id) ?? (f.providerPaymentRef ? "MERCADO_PAGO" : null)) : null;
    return {
      id: f.id,
      estado,
      fecha: (f.paidAt ?? f.createdAt).toISOString(),
      fotos: f.extraCount,
      totalCents: decimalArsToMinor(f.totalArs),
      feeCents: veDinero && f.feeArs !== null ? decimalArsToMinor(f.feeArs) : null,
      medio,
      proveedor: f.providerPaymentRef ? "Mercado Pago" : null,
      enCaja: f.cashMovementId !== null,
    };
  });
  const carrito = await carritoDeCliente(prisma, workspaceId, galeriaClienteId, config);
  const cajaEncendida = await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY);
  const cuentas =
    cajaEncendida && puedeGestionarGalerias(ctx)
      ? (await prisma.cashAccount.findMany({ where: { workspaceId, isActive: true, isVault: false }, orderBy: { order: "asc" }, select: { id: true, name: true, isDefault: true }, take: 50 })).map((c) => ({
          id: c.id, nombre: c.name, esPorOmision: c.isDefault,
        }))
      : [];
  return {
    ventaActiva: config.saleMode !== "SELECCION",
    compras,
    ahora: {
      extras: carrito.extras.length,
      incluidas: carrito.incluidas.length,
      yaPagadas: carrito.yaPagadas.length,
      subtotalCents: carrito.subtotalCents,
      descuentoCents: carrito.descuentoCents,
      totalCents: carrito.totalCents,
    },
    veDinero,
    cajaEncendida,
    cuentas,
  };
}
