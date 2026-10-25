// lib/course-marketplace/cobros.ts
/**
 * Cobros: lo que un negocio vendió y lo que le tocó de cada venta de cursos, desde el reparto
 * congelado (`CourseSaleShare`). Puro. Con el split apagado, cada venta la cobró quien vendió con
 * su Mercado Pago; esto es lo anotado, no un movimiento de plata.
 *
 * Los totales salen de agrupar en la base (`resumirGrupos`), no de la lista visible: la lista
 * tiene tope y los totales no.
 */

/** Un "123.45" de la base (Decimal(12,2) como texto) a centavos enteros, sin pasar por float. */
export function centavosDeDecimal(valor: string | null | undefined): number {
  const t = (valor ?? "0").trim() || "0";
  const negativo = t.startsWith("-");
  const [entero, dec = ""] = t.replace(/^[-+]/, "").split(".");
  const c = Number(entero || "0") * 100 + Number((dec + "00").slice(0, 2));
  return negativo ? -c : c;
}

/**
 * Un intento de Checkout Pro abandonado queda PENDING para siempre: "Pendiente" sólo cuenta las
 * inscripciones pendientes creadas dentro de esta ventana.
 */
export const HORAS_PENDIENTE_VIGENTE = 48;

/** Desde cuándo una inscripción PENDING todavía cuenta como pendiente. */
export function desdePendientesVigentes(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - HORAS_PENDIENTE_VIGENTE * 60 * 60 * 1000);
}

/** Lo que devuelve la base agrupado por curso y estado de pago (sólo las partes de este negocio). */
export type GrupoCobro = { cursoId: string; curso: string; estado: string; ventas: number; montoCentavos: number };

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
  porCurso: Array<{ cursoId: string; curso: string; ventas: number; cobradoCentavos: number }>;
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

/**
 * Totales desde los grupos de la base. `vendidoCentavos` llega aparte: es lo que pagaron los
 * alumnos de las ventas hechas por este negocio (lista − descuento + cargo por servicio).
 */
export function resumirGrupos(grupos: GrupoCobro[], vendidoCentavos: number): ResumenCobros {
  let cobradoCentavos = 0;
  let pendienteCentavos = 0;
  let ventasAprobadas = 0;
  const porCurso = new Map<string, ResumenCobros["porCurso"][number]>();
  for (const g of grupos) {
    if (g.estado === "PENDING") pendienteCentavos += g.montoCentavos;
    if (g.estado !== "APPROVED") continue;
    cobradoCentavos += g.montoCentavos;
    // Cada inscripción es de un solo curso: sumar los conteos por curso no repite ventas.
    ventasAprobadas += g.ventas;
    const c = porCurso.get(g.cursoId) ?? { cursoId: g.cursoId, curso: g.curso, ventas: 0, cobradoCentavos: 0 };
    c.ventas += g.ventas;
    c.cobradoCentavos += g.montoCentavos;
    porCurso.set(g.cursoId, c);
  }
  return {
    cobradoCentavos,
    pendienteCentavos,
    ventasAprobadas,
    vendidoCentavos,
    porCurso: [...porCurso.values()].sort((a, b) => b.cobradoCentavos - a.cobradoCentavos),
  };
}
