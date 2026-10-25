const RANGO: Record<string, number> = { CONFIRMED: 0, WAITLIST: 1, CANCELLED: 2 };

/** Confirmadas, después la espera (en orden de llegada) y al final las canceladas. */
export function ordenarAsistencia<T extends { status: string; createdAt: Date }>(filas: readonly T[]): T[] {
  return [...filas].sort((x, y) => (RANGO[x.status] ?? 9) - (RANGO[y.status] ?? 9) || x.createdAt.getTime() - y.createdAt.getTime());
}
