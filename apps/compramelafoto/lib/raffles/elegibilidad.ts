import type { EntrantInput } from "./padron";
import { publicName } from "./padron";

/**
 * Quién entra al sorteo. Módulo PURO: recibe las ventas ya contadas y las cuentas, devuelve
 * el padrón (sin ordenar).
 *
 * "Vender" es tener pedidos PAGADOS en el período: pedidos de álbum (`Order`) y pedidos de
 * impresión (`PrintOrder`) del fotógrafo, sin los de prueba. Eso lo cuenta `repository.ts`;
 * acá sólo se aplican las reglas sobre las cuentas.
 */

export type SalesByUser = ReadonlyMap<number, number>;

export type CandidateUser = {
  id: number;
  name: string | null;
  companyName: string | null;
  role: string;
  isBlocked: boolean;
  tags: string[] | null;
};

const ROLES_QUE_VENDEN = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);
const ETIQUETA_DEMO = "DEMO_PRESENTACION";

export type Exclusion = "rol" | "bloqueado" | "demo" | "excluido" | "pocas-ventas";

export function exclusionReason(
  user: CandidateUser,
  sales: number,
  minSales: number,
  excludedUserIds: ReadonlySet<number>,
): Exclusion | null {
  if (!ROLES_QUE_VENDEN.has(user.role)) return "rol";
  if (user.isBlocked) return "bloqueado";
  if (user.tags?.includes(ETIQUETA_DEMO)) return "demo";
  if (excludedUserIds.has(user.id)) return "excluido";
  if (sales < Math.max(1, minSales)) return "pocas-ventas";
  return null;
}

export function selectEntrants(input: {
  sales: SalesByUser;
  users: readonly CandidateUser[];
  minSales: number;
  excludedUserIds: readonly number[];
}): EntrantInput[] {
  const excluidos = new Set(input.excludedUserIds);
  const salida: EntrantInput[] = [];
  for (const u of input.users) {
    const ventas = input.sales.get(u.id) ?? 0;
    if (exclusionReason(u, ventas, input.minSales, excluidos) !== null) continue;
    salida.push({ userId: u.id, displayName: publicName(u), salesCount: ventas });
  }
  return salida;
}

/** Suma ventas por fotógrafo. Cada fila es una venta pagada; `userId` nulo no cuenta. */
export function countSales(rows: Iterable<{ userId: number | null | undefined }>): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (!r.userId) continue;
    m.set(r.userId, (m.get(r.userId) ?? 0) + 1);
  }
  return m;
}
