// lib/course-marketplace/cobros.ts
/**
 * Cobros: lo que un negocio vendió y lo que le tocó de cada venta de cursos, desde el reparto
 * congelado (`CourseSaleShare`). Puro. Con el split apagado, cada venta la cobró quien vendió con
 * su Mercado Pago; esto es lo anotado, no un movimiento de plata.
 */

export type FilaCobro = {
  id: string;
  enrollmentId: string;
  kind: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO";
  montoCentavos: number;
  pagaElAlumnoCentavos: number;
  curso: string;
  fecha: Date;
  estadoPago: string;
  vendioEsteNegocio: boolean;
};

export type ResumenCobros = {
  cobradoCentavos: number;
  pendienteCentavos: number;
  ventasAprobadas: number;
  vendidoCentavos: number;
  porCurso: Array<{ curso: string; ventas: number; cobradoCentavos: number }>;
};

export const ROTULO_DE_PARTE: Record<FilaCobro["kind"], string> = {
  PLATAFORMA: "Plataforma",
  REVENDEDOR: "Como revendedor",
  BENEFICIARIO: "Como beneficiario",
};

export const ESTADO_DE_PAGO: Record<string, string> = {
  APPROVED: "Cobrado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

export function resumirCobros(filas: FilaCobro[]): ResumenCobros {
  let cobradoCentavos = 0;
  let pendienteCentavos = 0;
  const aprobadas = new Set<string>();
  const vendidas = new Map<string, number>();
  const porCurso = new Map<string, { ventas: Set<string>; cobradoCentavos: number }>();

  for (const f of filas) {
    if (f.estadoPago === "PENDING") pendienteCentavos += f.montoCentavos;
    if (f.estadoPago !== "APPROVED") continue;
    cobradoCentavos += f.montoCentavos;
    aprobadas.add(f.enrollmentId);
    if (f.vendioEsteNegocio) vendidas.set(f.enrollmentId, f.pagaElAlumnoCentavos);
    const c = porCurso.get(f.curso) ?? { ventas: new Set<string>(), cobradoCentavos: 0 };
    c.ventas.add(f.enrollmentId);
    c.cobradoCentavos += f.montoCentavos;
    porCurso.set(f.curso, c);
  }

  return {
    cobradoCentavos,
    pendienteCentavos,
    ventasAprobadas: aprobadas.size,
    vendidoCentavos: [...vendidas.values()].reduce((s, v) => s + v, 0),
    porCurso: [...porCurso.entries()]
      .map(([curso, c]) => ({ curso, ventas: c.ventas.size, cobradoCentavos: c.cobradoCentavos }))
      .sort((a, b) => b.cobradoCentavos - a.cobradoCentavos),
  };
}
