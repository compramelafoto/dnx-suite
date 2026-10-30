import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import { lockStockRows } from "@/lib/sales/stock-lock";
import { applyStockMovement } from "@/lib/sales/variant-stock";
import type { FuenteConsumo } from "./consumo-servidor";
import {
  NOTA_EMBALAJE,
  calcularEmbalaje,
  piezasDeLineas,
  type EmbalajeCalculado,
  type EntregaProducto,
  type Envoltorio,
  type FormaEntrega,
  type PiezaEntrega,
  type TipoEnvoltorio,
} from "./embalaje";

/**
 * Embalaje contra la base: qué envoltorios tiene el negocio, cuáles le tocan a una entrega y cómo
 * se corrige después. El descuento en sí lo escribe `aplicarConsumo` junto con las recetas, en la
 * misma transacción y con el mismo bloqueo.
 */

type Tx = Prisma.TransactionClient | PrismaClient;

export type EmbalajeElegido = { insumoId: string; qty: number };
export type OpcionesEmbalaje = { modo: "auto" } | { modo: "manual"; elegido: readonly EmbalajeElegido[] } | { modo: "ninguno" };

/** El embalaje elegido a mano no se puede usar. El mensaje es para el mostrador. */
export class EmbalajeInvalido extends Error {}

const CANTIDAD_MAXIMA = 999;

type FilaEnvoltorio = {
  insumoId: string;
  tipo: string;
  admiteAnchoCm: unknown;
  admiteAltoCm: unknown;
  piezasPorUnidad: number | null;
  orden: number;
  insumo: { name: string; kind: string };
};

function aEnvoltorio(f: FilaEnvoltorio): Envoltorio {
  return {
    insumoId: f.insumoId,
    nombre: f.insumo.name,
    tipo: f.tipo as TipoEnvoltorio,
    admiteAnchoCm: Number(f.admiteAnchoCm),
    admiteAltoCm: Number(f.admiteAltoCm),
    piezasPorUnidad: f.piezasPorUnidad,
    orden: f.orden,
  };
}

const SELECT_ENVOLTORIO = {
  insumoId: true,
  tipo: true,
  admiteAnchoCm: true,
  admiteAltoCm: true,
  piezasPorUnidad: true,
  orden: true,
  insumo: { select: { name: true, kind: true } },
} as const;

/** Los envoltorios activos del negocio. Lo que dejó de ser insumo (cambió de `kind`) no cuenta. */
export async function envoltoriosActivos(tx: Tx, workspaceId: string): Promise<Envoltorio[]> {
  const filas = (await tx.fotofficeEmbalaje.findMany({
    where: { workspaceId, activo: true },
    orderBy: { orden: "asc" },
    select: SELECT_ENVOLTORIO,
  })) as FilaEnvoltorio[];
  return filas.filter((f) => f.insumo.kind === "INSUMO").map(aEnvoltorio);
}

/** Valida lo elegido a mano: envoltorios del negocio (activos o no) y cantidades enteras de 0 a 999. */
async function validarElegido(tx: Tx, workspaceId: string, elegido: readonly EmbalajeElegido[]): Promise<EmbalajeElegido[]> {
  const porInsumo = new Map<string, number>();
  for (const e of elegido) {
    if (typeof e.insumoId !== "string" || !Number.isInteger(e.qty) || e.qty < 0 || e.qty > CANTIDAD_MAXIMA) {
      throw new EmbalajeInvalido("La cantidad de embalaje no se entiende.");
    }
    porInsumo.set(e.insumoId, (porInsumo.get(e.insumoId) ?? 0) + e.qty);
  }
  const ids = [...porInsumo.keys()];
  if (ids.length === 0) return [];
  const filas = (await tx.fotofficeEmbalaje.findMany({
    where: { workspaceId, insumoId: { in: ids } },
    select: SELECT_ENVOLTORIO,
  })) as FilaEnvoltorio[];
  const propios = new Set(filas.filter((f) => f.insumo.kind === "INSUMO").map((f) => f.insumoId));
  if (ids.some((id) => !propios.has(id))) throw new EmbalajeInvalido("Ese embalaje no es de este negocio.");
  return [...porInsumo.entries()].filter(([, qty]) => qty > 0).map(([insumoId, qty]) => ({ insumoId, qty }));
}

/**
 * Qué envoltorios gasta una entrega. `combos` y `alcanzados` vienen de `planificarConsumo`, que
 * ya recorrió los combos para las recetas: así no se consulta dos veces.
 */
export async function planificarEmbalaje(
  tx: Tx,
  workspaceId: string,
  d: {
    lineas: readonly { productId: string | null; qty: number }[];
    combos: readonly { comboProductId: string; componentProductId: string; quantity: number }[];
    alcanzados: ReadonlySet<string>;
    piezasSinProducto: readonly PiezaEntrega[];
    opciones: OpcionesEmbalaje;
  },
): Promise<EmbalajeCalculado[]> {
  if (d.opciones.modo === "ninguno") return [];
  if (d.opciones.modo === "manual") {
    return (await validarElegido(tx, workspaceId, d.opciones.elegido)).map((e) => ({ ...e, motivo: "elegido a mano" }));
  }
  if (d.alcanzados.size === 0 && d.piezasSinProducto.length === 0) return [];
  const envoltorios = await envoltoriosActivos(tx, workspaceId);
  if (envoltorios.length === 0) return [];

  const filas =
    d.alcanzados.size > 0
      ? await tx.fotofficeProductoEntrega.findMany({
          where: { workspaceId, productId: { in: [...d.alcanzados] } },
          select: { productId: true, forma: true, anchoCm: true, altoCm: true, embalajeSiguiente: true, embalajeFijoId: true },
        })
      : [];
  // `embalajeFijoId` apunta a la fila del envoltorio; el cálculo trabaja con el insumo.
  const insumoDeFila = new Map(
    (
      await tx.fotofficeEmbalaje.findMany({
        where: { workspaceId, activo: true },
        select: { id: true, insumoId: true },
      })
    ).map((f) => [f.id, f.insumoId]),
  );
  const entregas = new Map<string, EntregaProducto>(
    filas.map((f) => [
      f.productId,
      {
        forma: f.forma as FormaEntrega,
        anchoCm: f.anchoCm === null ? null : Number(f.anchoCm),
        altoCm: f.altoCm === null ? null : Number(f.altoCm),
        embalajeSiguiente: f.embalajeSiguiente,
        embalajeFijoId: f.embalajeFijoId ? (insumoDeFila.get(f.embalajeFijoId) ?? null) : null,
      },
    ]),
  );
  const piezas = [...piezasDeLineas(d.lineas, entregas, d.combos), ...d.piezasSinProducto];
  return calcularEmbalaje(piezas, envoltorios);
}

/** Lo neto ya descontado como embalaje de una venta, pedido o pedido de impresión, por insumo. */
export async function embalajeDescontado(
  tx: Tx,
  d: { workspaceId: string; sourceModule: FuenteConsumo; sourceRef: string },
): Promise<Map<string, number>> {
  const movimientos = await tx.stockMovement.findMany({
    where: {
      workspaceId: d.workspaceId,
      sourceModule: d.sourceModule,
      sourceRef: d.sourceRef,
      reason: { in: ["CONSUMO", "DEVOLUCION"] },
      note: NOTA_EMBALAJE,
    },
    select: { productId: true, qty: true, note: true, reason: true },
  });
  const neto = new Map<string, number>();
  for (const m of movimientos) {
    if (m.note !== NOTA_EMBALAJE || (m.reason !== "CONSUMO" && m.reason !== "DEVOLUCION")) continue;
    neto.set(m.productId, (neto.get(m.productId) ?? 0) - m.qty);
  }
  for (const [k, v] of neto) if (v <= 0) neto.delete(k);
  return neto;
}

/**
 * Deja el embalaje de una fuente como `deseado`: escribe sólo la diferencia (más → `CONSUMO`,
 * menos → `DEVOLUCION`), con la nota del embalaje. Bloquea los insumos en el orden de siempre.
 */
export async function ajustarEmbalaje(
  tx: Tx,
  d: {
    workspaceId: string;
    sourceModule: FuenteConsumo;
    sourceRef: string;
    deseado: readonly EmbalajeElegido[];
    createdByUserId: number | null;
  },
): Promise<void> {
  const deseado = new Map((await validarElegido(tx, d.workspaceId, d.deseado)).map((e) => [e.insumoId, e.qty]));
  const actual = await embalajeDescontado(tx, d);
  const ids = [...new Set([...deseado.keys(), ...actual.keys()])].sort();
  const cambios = ids.map((id) => ({ id, diferencia: (deseado.get(id) ?? 0) - (actual.get(id) ?? 0) })).filter((c) => c.diferencia !== 0);
  if (cambios.length === 0) return;

  await lockStockRows(tx, { workspaceId: d.workspaceId, productIds: cambios.map((c) => c.id), variantIds: [] });
  for (const c of cambios) {
    await applyStockMovement(tx, {
      workspaceId: d.workspaceId,
      productId: c.id,
      variantId: null,
      qty: -c.diferencia,
      reason: c.diferencia > 0 ? "CONSUMO" : "DEVOLUCION",
      sourceModule: d.sourceModule,
      sourceRef: d.sourceRef,
      note: NOTA_EMBALAJE,
      unitCostArs: null,
      createdByUserId: d.createdByUserId,
    });
  }
}
