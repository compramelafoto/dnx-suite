/**
 * Saldos y totales. Módulo PURO, todo en centavos enteros.
 *
 * Hay una sola distinción que hacer, y es la que más fácil se hace mal: **el saldo de una
 * cuenta no es lo mismo que lo que entró y salió del negocio.**
 *
 * Las anulaciones entran en las dos cosas —ése es el punto de anular en vez de borrar—. Las
 * transferencias entre cuentas entran en el saldo y NO en los ingresos y egresos: la plata
 * no entró ni salió, cambió de lugar.
 */

export type BalanceMovement = {
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  /** Es una pata de un pase entre cuentas. Quien lee de la base lo pasa como `transferId !== null`. */
  isTransfer?: boolean;
};

/**
 * El saldo de una cuenta. **Incluye las transferencias**: si el pase a la caja fuerte no
 * descontara de la caja diaria, el mostrador figuraría con plata que ya no tiene.
 */
export function accountBalanceMinor(movements: readonly BalanceMovement[]): number {
  return movements.reduce(
    (acc, m) => acc + (m.kind === "INGRESO" ? m.amountMinor : -m.amountMinor),
    0,
  );
}

export type AccountBalanceMovement = BalanceMovement & { accountId: string };

/**
 * El saldo de cada cuenta del workspace, a la vez.
 *
 * Es el mismo criterio que `accountBalanceMinor` —una sola pasada, transferencias
 * incluidas— aplicado a varias cuentas juntas, para no repetir en cada pantalla el `filter`
 * por cuenta que antes vivía sólo en `/caja/reportes`. Un movimiento de una cuenta que no
 * viene en `accountIds` (dada de baja, o de otro momento) se ignora en vez de sumarse a un
 * saldo que nadie va a mostrar.
 */
export function balancesByAccountMinor(
  accountIds: readonly string[],
  movements: readonly AccountBalanceMovement[],
): Map<string, number> {
  const saldos = new Map<string, number>(accountIds.map((id) => [id, 0]));
  for (const m of movements) {
    if (!saldos.has(m.accountId)) continue;
    const delta = m.kind === "INGRESO" ? m.amountMinor : -m.amountMinor;
    saldos.set(m.accountId, (saldos.get(m.accountId) ?? 0) + delta);
  }
  return saldos;
}

/**
 * Cuánto entró y cuánto salió **del negocio**, que no es lo mismo que de una cuenta.
 *
 * Las transferencias quedan afuera. Un pase a la caja fuerte no es un gasto: la plata no
 * salió del negocio, cambió de lugar. Contarlo haría que los egresos del mes incluyeran los
 * treinta pases diarios, y el reporte mentiría por un orden de magnitud.
 */
export function periodSummary(movements: readonly BalanceMovement[]): {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
} {
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const m of movements) {
    if (m.isTransfer) continue;
    if (m.kind === "INGRESO") incomeMinor += m.amountMinor;
    else expenseMinor += m.amountMinor;
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
}

export type CategorizedMovement = BalanceMovement & {
  categoryId: string | null;
  categoryName: string | null;
};

export type CategoryTotal = {
  categoryId: string | null;
  categoryName: string;
  kind: "INGRESO" | "EGRESO";
  totalMinor: number;
  count: number;
};

/**
 * Agrupa por categoría Y por lado.
 *
 * Los dos, no sólo la categoría: "Reparaciones" puede tener ingresos —lo que se cobró— y
 * egresos —el repuesto que se compró—, y sumarlos juntos daría un número que no significa
 * nada.
 */
export function totalsByCategory(movements: readonly CategorizedMovement[]): CategoryTotal[] {
  const mapa = new Map<string, CategoryTotal>();
  for (const m of movements) {
    // Mismo criterio que `periodSummary`: un pase entre cuentas no es ingreso ni egreso.
    if (m.isTransfer) continue;
    const clave = `${m.kind}|${m.categoryId ?? ""}`;
    const actual = mapa.get(clave);
    if (actual) {
      actual.totalMinor += m.amountMinor;
      actual.count += 1;
    } else {
      mapa.set(clave, {
        categoryId: m.categoryId,
        categoryName: m.categoryName ?? "Sin categoría",
        kind: m.kind,
        totalMinor: m.amountMinor,
        count: 1,
      });
    }
  }
  return [...mapa.values()].sort((a, b) => b.totalMinor - a.totalMinor);
}

export type ClientMovement = BalanceMovement & {
  clientId: string | null;
  clientName: string | null;
};

export type ClientTotal = { clientId: string; clientName: string; totalMinor: number };

/**
 * Cuánto compró cada cliente. Sólo ingresos: un egreso a nombre de un cliente es una
 * devolución, y restarla acá haría que "cuánto me compró" dependiera de cómo se anuló algo.
 */
export function topClients(movements: readonly ClientMovement[], limit: number): ClientTotal[] {
  const mapa = new Map<string, ClientTotal>();
  for (const m of movements) {
    if (m.kind !== "INGRESO" || m.clientId === null) continue;
    const actual = mapa.get(m.clientId);
    if (actual) actual.totalMinor += m.amountMinor;
    else
      mapa.set(m.clientId, {
        clientId: m.clientId,
        clientName: m.clientName ?? "Sin nombre",
        totalMinor: m.amountMinor,
      });
  }
  return [...mapa.values()].sort((a, b) => b.totalMinor - a.totalMinor).slice(0, limit);
}
