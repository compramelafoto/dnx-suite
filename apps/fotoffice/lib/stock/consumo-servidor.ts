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

/**
 * Consumo de insumos contra la base: planificar (lecturas), aplicar y revertir
 * (escrituras). Quien llama bloquea las filas con `lockStockRows` entre
 * `planificarConsumo` y `aplicarConsumo`/`devolverConsumos`; acá no se bloquea.
 */

type Tx = Prisma.TransactionClient | PrismaClient;

export type PlanConsumo = { insumoIds: string[]; consumos: ConsumoLinea[] };
export type ConsumoPendiente = { insumoId: string; qty: number; note: string };
type Fuente = "sales" | "pedidos";

// Misma defensa que `expandirConsumo`: los ciclos no se guardan, pero si llegara
// uno corrupto la búsqueda de combos termina igual.
const VUELTAS_MAXIMAS = 10;

// Nunca `item:<id>`: esa nota la usa Pedidos para emparejar sus propias devoluciones.
const PREFIJO_NOTA = "consumo:item:";

export async function planificarConsumo(
  tx: Tx,
  workspaceId: string,
  lineas: readonly LineaVendida[],
): Promise<PlanConsumo> {
  const raices = new Set<string>();
  for (const l of lineas) if (l.productId) raices.add(l.productId);
  if (raices.size === 0) return { insumoIds: [], consumos: [] };

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
  if (candidatos.length === 0) return { insumoIds: [], consumos: [] };

  // Activo o no: un insumo desactivado se sigue descontando. Lo que ya no es
  // insumo (cambió de `kind`) queda fuera y su receta se ignora.
  const validos = await tx.product.findMany({
    where: { workspaceId, kind: "INSUMO", id: { in: candidatos } },
    select: { id: true },
  });
  const insumosValidos = new Set(validos.map((p) => p.id));

  const consumos = expandirConsumo(lineas, recetas, combos, insumosValidos);
  const insumoIds = [...new Set(consumos.map((c) => c.insumoId))].sort();
  return { insumoIds, consumos };
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
      note: `${PREFIJO_NOTA}${c.ref}`,
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
      note: { startsWith: PREFIJO_NOTA },
    },
    select: { productId: true, qty: true, note: true, reason: true },
  });

  // Pendiente = lo consumido (qty negativa) menos lo ya devuelto (qty positiva).
  const pendiente = new Map<string, ConsumoPendiente>();
  for (const m of movimientos) {
    const note = m.note ?? "";
    if (!note.startsWith(PREFIJO_NOTA)) continue;
    if (m.reason !== "CONSUMO" && m.reason !== "DEVOLUCION") continue;
    if (d.refs && !d.refs.has(note.slice(PREFIJO_NOTA.length))) continue;
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
