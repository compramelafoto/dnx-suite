/**
 * Comisión de venta del equipo. Módulo PURO, en centavos.
 *
 * Quien vende un fotolibro (tapa flexible, tapa rígida o su caja) gana un porcentaje del precio
 * de venta del renglón. Se gana cuando la venta queda cobrada entera: una venta del mostrador al
 * instante; un pedido, el día del cobro que completa el total. Lo que todavía tiene saldo queda
 * "a cobrar". Un pedido cancelado o una venta anulada no suman. El vendedor es quien la cargó.
 */

export type ReglaComision = { userId: number; porcentaje: number; desde: Date };

export type RenglonComision = { nombre: string; baseMinor: number };

export type PedidoComision = {
  id: string;
  numero: string;
  vendedorId: number | null;
  creado: Date;
  estado: string;
  totalMinor: number;
  renglones: RenglonComision[];
  /** Cobros sin anular. */
  cobros: { montoMinor: number; fecha: Date }[];
};

export type VentaComision = {
  id: string;
  numero: string;
  vendedorId: number | null;
  fecha: Date;
  renglones: RenglonComision[];
};

export type Comision = {
  origen: "PEDIDO" | "VENTA";
  id: string;
  numero: string;
  vendedorId: number;
  descripcion: string;
  baseMinor: number;
  comisionMinor: number;
  /** null = todavía no está cobrada entera. */
  ganadaEl: Date | null;
  vendidaEl: Date;
};

export function comisionDe(baseMinor: number, porcentaje: number): number {
  return Math.round((baseMinor * porcentaje) / 100);
}

/** El día del cobro que completa el total; null si todavía falta (un peso de tolerancia). */
export function cobradoEnteroEl(totalMinor: number, cobros: readonly { montoMinor: number; fecha: Date }[]): Date | null {
  let acumulado = 0;
  for (const c of [...cobros].sort((a, b) => a.fecha.getTime() - b.fecha.getTime())) {
    acumulado += c.montoMinor;
    if (acumulado >= totalMinor - 100) return c.fecha;
  }
  return null;
}

function describir(renglones: readonly RenglonComision[]): string {
  return renglones.map((r) => r.nombre).join(" + ");
}

export function calcularComisiones(
  reglas: readonly ReglaComision[],
  pedidos: readonly PedidoComision[],
  ventas: readonly VentaComision[],
): Comision[] {
  const reglaDe = new Map(reglas.map((r) => [r.userId, r]));
  const out: Comision[] = [];
  for (const p of pedidos) {
    const regla = p.vendedorId === null ? undefined : reglaDe.get(p.vendedorId);
    if (!regla || p.estado === "CANCELADO" || p.creado < regla.desde || p.renglones.length === 0 || p.totalMinor <= 0) continue;
    const baseMinor = p.renglones.reduce((s, r) => s + r.baseMinor, 0);
    out.push({
      origen: "PEDIDO",
      id: p.id,
      numero: p.numero,
      vendedorId: regla.userId,
      descripcion: describir(p.renglones),
      baseMinor,
      comisionMinor: comisionDe(baseMinor, regla.porcentaje),
      ganadaEl: cobradoEnteroEl(p.totalMinor, p.cobros),
      vendidaEl: p.creado,
    });
  }
  for (const v of ventas) {
    const regla = v.vendedorId === null ? undefined : reglaDe.get(v.vendedorId);
    if (!regla || v.fecha < regla.desde || v.renglones.length === 0) continue;
    const baseMinor = v.renglones.reduce((s, r) => s + r.baseMinor, 0);
    out.push({
      origen: "VENTA",
      id: v.id,
      numero: v.numero,
      vendedorId: regla.userId,
      descripcion: describir(v.renglones),
      baseMinor,
      comisionMinor: comisionDe(baseMinor, regla.porcentaje),
      ganadaEl: v.fecha,
      vendidaEl: v.fecha,
    });
  }
  return out.sort((a, b) => (b.ganadaEl ?? b.vendidaEl).getTime() - (a.ganadaEl ?? a.vendidaEl).getTime());
}

export type ResumenComisiones = { mesMinor: number; totalMinor: number; aCobrarMinor: number };

/** Lo de una persona para el Cobrador: su porcentaje y lo acumulado. */
export type MiComision = { porcentaje: number; resumen: ResumenComisiones };

/** Lo ganado en el mes (desde `inicioMes`), lo ganado desde siempre y lo que espera el saldo. */
export function resumir(comisiones: readonly Comision[], inicioMes: Date): ResumenComisiones {
  let mesMinor = 0;
  let totalMinor = 0;
  let aCobrarMinor = 0;
  for (const c of comisiones) {
    if (c.ganadaEl === null) aCobrarMinor += c.comisionMinor;
    else {
      totalMinor += c.comisionMinor;
      if (c.ganadaEl >= inicioMes) mesMinor += c.comisionMinor;
    }
  }
  return { mesMinor, totalMinor, aCobrarMinor };
}

/** El primer instante del mes en Argentina (UTC−3), para "lo ganado este mes". */
export function inicioDelMesEnArgentina(ahora: Date): Date {
  const ar = new Date(ahora.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), 1, 3));
}
