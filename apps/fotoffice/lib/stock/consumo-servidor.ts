import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import { applyStockMovement } from "@/lib/sales/variant-stock";
import {
  expandirConsumo,
  type ComponenteCombo,
  type ConsumoLinea,
  type LineaVendida,
  type Receta,
} from "./consumo";
import { NOTA_EMBALAJE, REF_EMBALAJE, type PiezaEntrega } from "./embalaje";
import { planificarEmbalaje, type OpcionesEmbalaje } from "./embalaje-servidor";

/**
 * Consumo de insumos contra la base: planificar (lecturas), aplicar y revertir
 * (escrituras). Incluye el embalaje de la entrega (sobres, bolsas) como una línea más con
 * `ref = REF_EMBALAJE` y nota `NOTA_EMBALAJE`: así hereda el bloqueo y la devolución. Quien llama bloquea las filas con `lockStockRows` entre
 * `planificarConsumo` y `aplicarConsumo`/`devolverConsumos`; acá no se bloquea.
 */

type Tx = Prisma.TransactionClient | PrismaClient;

export type PlanConsumo = { insumoIds: string[]; consumos: ConsumoLinea[] };
export type ConsumoPendiente = { insumoId: string; qty: number; note: string };
export type FuenteConsumo = "sales" | "pedidos" | "impresiones";
type Fuente = FuenteConsumo;

// Misma defensa que `expandirConsumo`: los ciclos no se guardan, pero si llegara
// uno corrupto la búsqueda de combos termina igual.
const VUELTAS_MAXIMAS = 10;

// Nunca `item:<id>`: esa nota la usa Pedidos para emparejar sus propias devoluciones.
const PREFIJO_NOTA = "consumo:item:";

export async function planificarConsumo(
  tx: Tx,
  workspaceId: string,
  lineas: readonly LineaVendida[],
  opciones: { embalaje?: OpcionesEmbalaje; piezasSinProducto?: readonly PiezaEntrega[] } = {},
): Promise<PlanConsumo> {
  const raices = new Set<string>();
  for (const l of lineas) if (l.productId) raices.add(l.productId);
  const consumos = await consumoDeRecetas(tx, workspaceId, lineas, raices);
  const embalaje = await planificarEmbalaje(tx, workspaceId, {
    lineas,
    combos: consumos.combos,
    alcanzados: consumos.alcanzados,
    piezasSinProducto: opciones.piezasSinProducto ?? [],
    opciones: opciones.embalaje ?? { modo: "auto" },
  });
  const todos = [...consumos.lineas, ...embalaje.map((e) => ({ ref: REF_EMBALAJE, insumoId: e.insumoId, qty: e.qty }))];
  return { insumoIds: [...new Set(todos.map((c) => c.insumoId))].sort(), consumos: todos };
}

async function consumoDeRecetas(
  tx: Tx,
  workspaceId: string,
  lineas: readonly LineaVendida[],
  raices: ReadonlySet<string>,
): Promise<{ lineas: ConsumoLinea[]; combos: ComponenteCombo[]; alcanzados: Set<string> }> {
  if (raices.size === 0) return { lineas: [], combos: [], alcanzados: new Set() };

  // En anchura: cada vuelta trae los componentes de los combos recién hallados.
  const combos: ComponenteCombo[] = [];
  const alcanzados = new Set(raices);
  let frontera = [...raices];
  for (let vuelta = 0; vuelta < VUELTAS_MAXIMAS && frontera.length > 0; vuelta++) {
    const filas = await tx.fotofficeComboItem.findMany({
      where: { workspaceId, comboProductId: { in: frontera } },
      select: { comboProductId: true, componentProductId: true, quantity: true },
    });
    combos.push(...filas);
    frontera = [];
    for (const f of filas) {
      if (!alcanzados.has(f.componentProductId)) {
        alcanzados.add(f.componentProductId);
        frontera.push(f.componentProductId);
      }
    }
  }

  const recetas: Receta[] = await tx.fotofficeRecetaInsumo.findMany({
    where: { workspaceId, productId: { in: [...alcanzados] } },
    select: { productId: true, insumoId: true, quantity: true, porCada: true },
  });
  const candidatos = [...new Set(recetas.map((r) => r.insumoId))];
  if (candidatos.length === 0) return { lineas: [], combos, alcanzados };

  // Activo o no: un insumo desactivado se sigue descontando. Lo que ya no es
  // insumo (cambió de `kind`) queda fuera y su receta se ignora.
  const validos = await tx.product.findMany({
    where: { workspaceId, kind: "INSUMO", id: { in: candidatos } },
    select: { id: true },
  });
  const insumosValidos = new Set(validos.map((p) => p.id));

  return { lineas: expandirConsumo(lineas, recetas, combos, insumosValidos), combos, alcanzados };
}

/** La nota de un consumo: la del renglón, o la del embalaje de toda la entrega. */
function notaDe(ref: string): string {
  return ref === REF_EMBALAJE ? NOTA_EMBALAJE : `${PREFIJO_NOTA}${ref}`;
}

/** El `ref` de una nota de consumo, o null si la nota no es de consumo. */
function refDeNota(note: string): string | null {
  if (note === NOTA_EMBALAJE) return REF_EMBALAJE;
  return note.startsWith(PREFIJO_NOTA) ? note.slice(PREFIJO_NOTA.length) : null;
}

export async function aplicarConsumo(
  tx: Tx,
  d: {
    workspaceId: string;
    plan: PlanConsumo;
    sourceModule: Fuente;
    sourceRef: string;
    createdByUserId: number | null;
  },
): Promise<void> {
  for (const c of d.plan.consumos) {
    await applyStockMovement(tx, {
      workspaceId: d.workspaceId,
      productId: c.insumoId,
      variantId: null,
      qty: -c.qty,
      reason: "CONSUMO",
      sourceModule: d.sourceModule,
      sourceRef: d.sourceRef,
      note: notaDe(c.ref),
      unitCostArs: null,
      createdByUserId: d.createdByUserId,
    });
  }
}

export async function consumosPendientesDeDevolver(
  tx: Tx,
  d: {
    workspaceId: string;
    sourceModule: Fuente;
    sourceRef: string;
    refs: ReadonlySet<string> | null;
  },
): Promise<ConsumoPendiente[]> {
  const movimientos = await tx.stockMovement.findMany({
    where: {
      workspaceId: d.workspaceId,
      sourceModule: d.sourceModule,
      sourceRef: d.sourceRef,
      reason: { in: ["CONSUMO", "DEVOLUCION"] },
      OR: [{ note: { startsWith: PREFIJO_NOTA } }, { note: NOTA_EMBALAJE }],
    },
    select: { productId: true, qty: true, note: true, reason: true },
  });

  // Pendiente = lo consumido (qty negativa) menos lo ya devuelto (qty positiva).
  const pendiente = new Map<string, ConsumoPendiente>();
  for (const m of movimientos) {
    const note = m.note ?? "";
    const ref = refDeNota(note);
    if (ref === null) continue;
    if (m.reason !== "CONSUMO" && m.reason !== "DEVOLUCION") continue;
    if (d.refs && !d.refs.has(ref)) continue;
    const clave = `${note}\u0000${m.productId}`;
    const actual = pendiente.get(clave) ?? { insumoId: m.productId, qty: 0, note };
    actual.qty -= m.qty;
    pendiente.set(clave, actual);
  }
  return [...pendiente.values()].filter((p) => p.qty > 0);
}

export async function devolverConsumos(
  tx: Tx,
  d: {
    workspaceId: string;
    pendientes: readonly ConsumoPendiente[];
    sourceModule: Fuente;
    sourceRef: string;
    createdByUserId: number | null;
  },
): Promise<void> {
  for (const p of d.pendientes) {
    await applyStockMovement(tx, {
      workspaceId: d.workspaceId,
      productId: p.insumoId,
      variantId: null,
      qty: p.qty,
      reason: "DEVOLUCION",
      sourceModule: d.sourceModule,
      sourceRef: d.sourceRef,
      note: p.note,
      unitCostArs: null,
      createdByUserId: d.createdByUserId,
    });
  }
}
