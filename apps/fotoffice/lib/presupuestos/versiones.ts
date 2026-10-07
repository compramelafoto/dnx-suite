import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { MENSAJES_PRESUPUESTO, puedeGestionarPresupuestos, type CtxPresupuestos } from "./acceso";
import { entradaDelMotor, recalcularItemCalculo } from "./calculo-cuanto-cobro";
import {
  esEstadoPresupuesto,
  itemSinDatosInternos,
  validarDescuento,
  validarItems,
  type Descuento,
  type ItemPresupuesto,
  type ResultadoValidacion,
} from "./constantes";
import { ESTADOS_CERRADOS } from "./estados";
import { calcularTotales, type TotalesPresupuesto } from "./totales";

/**
 * Versiones de un presupuesto (V1, V2…), spec §2 A.4 y §4.1.
 *
 * - Una versión con `sentAt` es INMUTABLE: nada de este archivo la vuelve a escribir, salvo su
 *   token (revocarlo cuando sale la siguiente) y la aceptación (Task 5).
 * - Hay como mucho UN borrador por presupuesto: la versión sin `sentAt`.
 * - `currentVersionId` es la vigente, la que muestra el enlace: la última enviada, o la V1 si
 *   nunca se envió. Un borrador nuevo (V2…) NO es vigente hasta que se envía: mientras tanto el
 *   enlace sigue mostrando la anterior.
 * - Cada guardado del borrador arma de nuevo las instantáneas en el servidor: ítems validados,
 *   los de ¿Cuánto Cobro? recalculados con el motor desde sus entradas (R2), totales y
 *   `costSnapshot`. Así, al congelar (enviar) no hay nada que calcular: se copia lo guardado.
 * - `costSnapshot` y la instantánea del cálculo son internos: `versionParaVista` los saca para
 *   quien no tiene `configurar` ni `verDinero`.
 */

type Tx = Prisma.TransactionClient;

/** Lo que se guarda en `totals`: los totales y el descuento global que los produjo. */
export type TotalesGuardados = TotalesPresupuesto & { descuento: Descuento | null };

export type OrigenCosto = "CALCULO" | "COSTOS_PLANTILLA" | "COSTO_PRODUCTO";

/** `costSnapshot`. Pesos con dos decimales. INTERNO. */
export type CostosVersion = {
  porItem: Record<string, { costo: number | null; origen: OrigenCosto | null; margen: number | null }>;
  /** Costo conocido de los renglones que suman (los opcionales no). */
  costoTotal: number;
  /** Renglones que suman y no tienen costo conocido (texto libre, producto sin costos). */
  itemsSinCosto: number;
  /** Total menos costo conocido. */
  margen: number;
  /** Margen sobre el total (null si el total es 0). */
  margenProporcion: number | null;
};

export type EntradaBorrador = {
  items: unknown;
  descuento?: unknown;
  condiciones?: unknown;
  propuestaPago?: unknown;
};

export type BorradorNormalizado = {
  items: ItemPresupuesto[];
  totals: TotalesGuardados;
  terms: string | null;
  paymentProposal: string | null;
  costSnapshot: CostosVersion;
};

export const MAX_TEXTO_VERSION = 4000;

const aCentavos = (pesos: number): number => Math.round(pesos * 100);
const aPesos = (centavos: number): number => centavos / 100;

function textoVersion(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t.length > MAX_TEXTO_VERSION) return undefined;
  return t === "" ? null : t;
}

// --- Costos -------------------------------------------------------------------------------------

export type CostoDeCatalogo = {
  /** Costos-plantilla del producto (en pesos). Si hay, mandan sobre `costoProducto`. */
  plantillas: { importe: number; porUnidad: boolean }[];
  /** `Product.costArs`, por unidad; null si no tiene. */
  costoProducto: number | null;
};

/**
 * Costo y margen de una versión. PURO.
 * - ítem de ¿Cuánto Cobro?: el precio mínimo sostenible del cálculo (lo que cubre horas y costos);
 * - ítem del catálogo: sus costos-plantilla (fijos una vez, por unidad × cantidad) o, si no tiene,
 *   su costo por unidad × cantidad;
 * - ítem de texto libre o sin costos: sin costo conocido.
 */
export function costosDeVersion(
  items: readonly ItemPresupuesto[],
  totales: TotalesPresupuesto,
  catalogo: ReadonlyMap<string, CostoDeCatalogo>,
): CostosVersion {
  const porItem: CostosVersion["porItem"] = {};
  let costo = 0;
  let sinCosto = 0;
  for (const it of items) {
    let c: number | null = null;
    let origen: OrigenCosto | null = null;
    if (it.modoPrecio === "CALCULO" && it.calculo) {
      c = aCentavos(it.calculo.precioMinimo);
      origen = "CALCULO";
    } else if (it.productId && catalogo.has(it.productId)) {
      const k = catalogo.get(it.productId)!;
      if (k.plantillas.length > 0) {
        c = k.plantillas.reduce((s, p) => s + (p.porUnidad ? Math.round(aCentavos(p.importe) * it.cantidad) : aCentavos(p.importe)), 0);
        origen = "COSTOS_PLANTILLA";
      } else if (k.costoProducto !== null) {
        c = Math.round(aCentavos(k.costoProducto) * it.cantidad);
        origen = "COSTO_PRODUCTO";
      }
    }
    const neto = aCentavos(totales.renglones[it.id]?.neto ?? 0);
    porItem[it.id] = { costo: c === null ? null : aPesos(c), origen, margen: c === null ? null : aPesos(neto - c) };
    if (it.opcional) continue;
    if (c === null) sinCosto += 1;
    else costo += c;
  }
  const total = aCentavos(totales.total);
  const margen = total - costo;
  return {
    porItem,
    costoTotal: aPesos(costo),
    itemsSinCosto: sinCosto,
    margen: aPesos(margen),
    margenProporcion: total > 0 ? Math.round((margen / total) * 10_000) / 10_000 : null,
  };
}

async function costosDelCatalogo(workspaceId: string, productIds: string[]): Promise<Map<string, CostoDeCatalogo>> {
  const mapa = new Map<string, CostoDeCatalogo>();
  if (productIds.length === 0) return mapa;
  const [productos, plantillas] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId, id: { in: productIds } }, select: { id: true, costArs: true } }),
    prisma.fotofficeCostoPlantilla.findMany({
      where: { workspaceId, productId: { in: productIds } },
      select: { productId: true, amountArs: true, perUnit: true },
    }),
  ]);
  for (const p of productos) {
    mapa.set(p.id, { plantillas: [], costoProducto: p.costArs === null ? null : aPesos(decimalArsToMinor(p.costArs)) });
  }
  for (const k of plantillas) {
    mapa.get(k.productId)?.plantillas.push({ importe: aPesos(decimalArsToMinor(k.amountArs)), porUnidad: k.perUnit });
  }
  return mapa;
}

// --- Normalizar el borrador -----------------------------------------------------------------------

/** La entrada guardada del cálculo de cada ítem de un borrador (para recalcular sin que la reenvíen). */
export function entradasGuardadas(itemsGuardados: unknown): Map<string, unknown> {
  const mapa = new Map<string, unknown>();
  if (!Array.isArray(itemsGuardados)) return mapa;
  for (const x of itemsGuardados) {
    const it = x as { id?: unknown; modoPrecio?: unknown; calculo?: { entrada?: unknown } | null } | null;
    if (it && typeof it.id === "string" && it.modoPrecio === "CALCULO" && it.calculo?.entrada) mapa.set(it.id, it.calculo.entrada);
  }
  return mapa;
}

/**
 * Valida y arma las instantáneas de un borrador. No confía en nada de lo que llega:
 * - ítems con `validarItems`;
 * - cada producto del catálogo, del MISMO workspace;
 * - cada ítem de ¿Cuánto Cobro? se recalcula con el motor (R2). La entrada sale del ítem que
 *   llegó o, si no la trae (quien no ve costos recibe los ítems sin el cálculo), de la que estaba
 *   guardada para ese mismo ítem;
 * - totales y costos se calculan acá.
 */
export async function normalizarBorrador(
  workspaceId: string,
  entrada: EntradaBorrador,
  guardadas: ReadonlyMap<string, unknown>,
  ahora: Date,
): Promise<ResultadoValidacion<BorradorNormalizado>> {
  if (!entrada || typeof entrada !== "object") return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
  const v = validarItems(entrada.items);
  if (!v.ok) return v;
  const descuento = validarDescuento(entrada.descuento);
  if (!descuento.ok) return descuento;
  const terms = textoVersion(entrada.condiciones);
  const paymentProposal = textoVersion(entrada.propuestaPago);
  if (terms === undefined || paymentProposal === undefined) return { ok: false, error: MENSAJES_PRESUPUESTO.texto };

  const items: ItemPresupuesto[] = [];
  for (const it of v.valor) {
    if (it.modoPrecio !== "CALCULO") {
      items.push({ ...it, calculo: null });
      continue;
    }
    const cruda = (it.calculo as { entrada?: unknown } | null)?.entrada ?? guardadas.get(it.id);
    if (cruda === undefined || cruda === null) return { ok: false, error: `${MENSAJES_PRESUPUESTO.calculoFaltante} (${it.nombre})` };
    const motor = entradaDelMotor(cruda);
    if (!motor) return { ok: false, error: `${MENSAJES_PRESUPUESTO.calculoInvalido} (${it.nombre})` };
    const r = recalcularItemCalculo(it, motor, ahora);
    if (!r.ok) return { ok: false, error: `${r.error} (${it.nombre})` };
    items.push(r.item);
  }

  const productIds = [...new Set(items.map((i) => i.productId).filter((x): x is string => x !== null))];
  const catalogo = await costosDelCatalogo(workspaceId, productIds);
  if (productIds.some((id) => !catalogo.has(id))) return { ok: false, error: MENSAJES_PRESUPUESTO.producto };

  const totales = calcularTotales(items, descuento.valor);
  return {
    ok: true,
    valor: {
      items,
      totals: { ...totales, descuento: descuento.valor },
      terms,
      paymentProposal,
      costSnapshot: costosDeVersion(items, totales, catalogo),
    },
  };
}

/** Totales de una versión vacía (la V1 recién creada). */
export function totalesVacios(): TotalesGuardados {
  return { ...calcularTotales([], null), descuento: null };
}

export function costosVacios(): CostosVersion {
  return costosDeVersion([], calcularTotales([], null), new Map());
}

// --- Lectura (con o sin costos) -----------------------------------------------------------------

/** Ítem para quien no ve costos: sin la instantánea del cálculo. */
export type ItemEquipo = Omit<ItemPresupuesto, "calculo"> & { calculo: null };

export function itemParaEquipo(item: ItemPresupuesto): ItemEquipo {
  return { ...itemSinDatosInternos(item), productId: item.productId ?? null, calculo: null };
}

export type VersionVista = {
  id: string;
  number: number;
  items: ItemPresupuesto[] | ItemEquipo[];
  totals: TotalesGuardados;
  terms: string | null;
  paymentProposal: string | null;
  sentAt: Date | null;
  revokedAt: Date | null;
  acceptedAt: Date | null;
  /** Sólo con permiso de costos; si no, null. */
  costos: CostosVersion | null;
};

export const SELECT_VERSION = {
  id: true,
  number: true,
  items: true,
  totals: true,
  terms: true,
  paymentProposal: true,
  costSnapshot: true,
  sentAt: true,
  revokedAt: true,
  acceptedAt: true,
} as const;

type FilaVersion = {
  id: string;
  number: number;
  items: unknown;
  totals: unknown;
  terms: string | null;
  paymentProposal: string | null;
  costSnapshot: unknown;
  sentAt: Date | null;
  revokedAt: Date | null;
  acceptedAt: Date | null;
};

/** Ítems guardados (JSON de la base), revisados: un renglón que no valida no se muestra. */
export function itemsGuardados(raw: unknown): ItemPresupuesto[] {
  if (!Array.isArray(raw)) return [];
  const v = validarItems(raw);
  return v.ok ? v.valor : [];
}

export function versionParaVista(fila: FilaVersion, conCostos: boolean): VersionVista {
  const items = itemsGuardados(fila.items);
  return {
    id: fila.id,
    number: fila.number,
    items: conCostos ? items : items.map(itemParaEquipo),
    totals: (fila.totals as TotalesGuardados | null) ?? totalesVacios(),
    terms: fila.terms,
    paymentProposal: fila.paymentProposal,
    sentAt: fila.sentAt,
    revokedAt: fila.revokedAt,
    acceptedAt: fila.acceptedAt,
    costos: conCostos ? ((fila.costSnapshot as CostosVersion | null) ?? null) : null,
  };
}

// --- Versión nueva ------------------------------------------------------------------------------

/** Candado por presupuesto: serializa guardar, versionar y enviar el mismo presupuesto. */
export function bloquearPresupuesto(tx: Tx, presupuestoId: string) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-presupuesto:${presupuestoId}`}))`;
}

export type ResultadoVersionNueva =
  | { ok: true; versionId: string; number: number; yaExistia: boolean }
  | { ok: false; error: string };

/**
 * "Editar" un presupuesto enviado: copia la vigente (ítems, totales, textos y costos, en copia
 * profunda) como el borrador de la versión siguiente (número + 1). La vigente NO cambia: sigue
 * siendo la del enlace hasta que se envíe la nueva, y al enviarla se revoca el token de la
 * anterior (`revocarAnteriores`, Task 5).
 *
 * Si ya hay un borrador lo devuelve (dos clics o dos pestañas no crean dos). Un presupuesto
 * aceptado no se edita.
 */
export async function crearNuevaVersion(ctx: CtxPresupuestos, presupuestoId: unknown): Promise<ResultadoVersionNueva> {
  if (!puedeGestionarPresupuestos(ctx)) return { ok: false, error: MENSAJES_PRESUPUESTO.sinPermiso };
  if (typeof presupuestoId !== "string" || presupuestoId === "") return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
  const { workspaceId } = ctx;
  const intentar = () =>
    prisma.$transaction(async (tx): Promise<ResultadoVersionNueva> => {
      await bloquearPresupuesto(tx, presupuestoId);
      const p = await tx.fotofficePresupuesto.findFirst({
        where: { id: presupuestoId, workspaceId },
        select: { id: true, status: true, currentVersionId: true },
      });
      if (!p) return { ok: false, error: MENSAJES_PRESUPUESTO.noExiste };
      if (!esEstadoPresupuesto(p.status) || ESTADOS_CERRADOS.includes(p.status)) return { ok: false, error: MENSAJES_PRESUPUESTO.aceptado };

      const borrador = await tx.fotofficePresupuestoVersion.findFirst({
        where: { workspaceId, presupuestoId, sentAt: null },
        select: { id: true, number: true },
      });
      if (borrador) return { ok: true, versionId: borrador.id, number: borrador.number, yaExistia: true };

      const base = p.currentVersionId
        ? await tx.fotofficePresupuestoVersion.findFirst({
            where: { id: p.currentVersionId, workspaceId, presupuestoId },
            select: { items: true, totals: true, terms: true, paymentProposal: true, costSnapshot: true },
          })
        : null;
      if (!base) return { ok: false, error: MENSAJES_PRESUPUESTO.noExiste };
      const ultima = await tx.fotofficePresupuestoVersion.findFirst({
        where: { workspaceId, presupuestoId },
        orderBy: [{ number: "desc" }],
        select: { number: true },
      });
      const number = (ultima?.number ?? 0) + 1;
      // Copia profunda: la versión nueva no comparte nada con la enviada.
      const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
      const nueva = await tx.fotofficePresupuestoVersion.create({
        data: {
          workspaceId,
          presupuestoId,
          number,
          items: copia(base.items) as Prisma.InputJsonValue,
          totals: copia(base.totals) as Prisma.InputJsonValue,
          terms: base.terms,
          paymentProposal: base.paymentProposal,
          costSnapshot: (base.costSnapshot === null ? costosVacios() : copia(base.costSnapshot)) as Prisma.InputJsonValue,
          createdByUserId: ctx.userId,
        },
        select: { id: true, number: true },
      });
      await tx.fotofficePresupuesto.update({ where: { id: presupuestoId }, data: { updatedAt: new Date() }, select: { id: true } });
      return { ok: true, versionId: nueva.id, number: nueva.number, yaExistia: false };
    });

  try {
    return await intentar();
  } catch (e) {
    // Otra transacción creó el mismo número a la vez (único presupuestoId+number): devolver la suya.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    return intentar();
  }
}

// --- Congelar y revocar (los usa el envío, Task 5) -------------------------------------------------

/**
 * Congela un borrador: le pone `sentAt` (y, si vienen, el hash del token y su vencimiento).
 * Las instantáneas ya están armadas desde el último guardado. Condicional (`sentAt IS NULL`):
 * devuelve false si otra transacción ya la congeló.
 */
export async function congelarVersion(
  tx: Tx,
  args: { workspaceId: string; versionId: string; ahora: Date; tokenHash?: string | null; tokenExpiresAt?: Date | null },
): Promise<boolean> {
  const r = await tx.fotofficePresupuestoVersion.updateMany({
    where: { id: args.versionId, workspaceId: args.workspaceId, sentAt: null },
    data: { sentAt: args.ahora, tokenHash: args.tokenHash ?? null, tokenExpiresAt: args.tokenExpiresAt ?? null },
  });
  return r.count === 1;
}

/** Revoca el token de las versiones anteriores (todas menos `vigente`). Devuelve cuántas. */
export async function revocarAnteriores(
  tx: Tx,
  args: { workspaceId: string; presupuestoId: string; vigenteId: string; ahora: Date },
): Promise<number> {
  const r = await tx.fotofficePresupuestoVersion.updateMany({
    where: { workspaceId: args.workspaceId, presupuestoId: args.presupuestoId, id: { not: args.vigenteId }, revokedAt: null },
    data: { revokedAt: args.ahora },
  });
  return r.count;
}
