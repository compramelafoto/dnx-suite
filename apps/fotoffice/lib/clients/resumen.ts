import type { Entidad } from "@/lib/entidades/colores";

/**
 * Los cuadros de colores de la ficha del cliente: cuántas consultas, cotizaciones, pedidos,
 * contratos y proyectos tiene, y cuánto pagó y debe. Módulo puro (lo prueba `resumen.test.ts`).
 * Cada grupo es null cuando la persona no lo puede ver (o el módulo está apagado): ese cuadro no
 * aparece.
 */
export type EntradaResumen = {
  consultas: { cantidad: number; hayMas: boolean } | null;
  cotizaciones: { estado: string }[] | null;
  pedidos: { estado: string; total: number; aCobrar: number; vencido: number }[] | null;
  contratos: { estado: string }[] | null;
  proyectos: { estado: string }[] | null;
};

export type CuadroDeResumen = { entidad: Entidad; valor: string; detalle: string | null; href: string };

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function cuadrosDelResumen(e: EntradaResumen, pesos: (n: number) => string): CuadroDeResumen[] {
  const out: CuadroDeResumen[] = [];
  if (e.consultas) {
    out.push({ entidad: "consulta", valor: `${e.consultas.cantidad}${e.consultas.hayMas ? "+" : ""}`, detalle: null, href: "#consultas" });
  }
  if (e.cotizaciones) {
    const aceptadas = e.cotizaciones.filter((c) => c.estado === "ACEPTADO").length;
    out.push({ entidad: "cotizacion", valor: String(e.cotizaciones.length), detalle: aceptadas > 0 ? plural(aceptadas, "aceptada", "aceptadas") : null, href: "#cotizaciones" });
  }
  // Los pedidos cancelados cuentan como pedido pero no suman dinero.
  const activos = e.pedidos?.filter((p) => p.estado !== "CANCELADO") ?? [];
  if (e.pedidos) {
    const enCurso = activos.filter((p) => p.estado === "CONFIRMADO" || p.estado === "EN_CURSO").length;
    out.push({ entidad: "pedido", valor: String(e.pedidos.length), detalle: enCurso > 0 ? `${enCurso} en curso` : null, href: "#pedidos" });
  }
  if (e.contratos) {
    const firmados = e.contratos.filter((c) => c.estado === "FIRMADO").length;
    out.push({ entidad: "contrato", valor: String(e.contratos.length), detalle: firmados > 0 ? plural(firmados, "firmado", "firmados") : null, href: "#contratos" });
  }
  if (e.proyectos) {
    const enCurso = e.proyectos.filter((p) => p.estado === "EN_CURSO").length;
    out.push({ entidad: "proyecto", valor: String(e.proyectos.length), detalle: enCurso > 0 ? `${enCurso} en curso` : null, href: "#proyectos" });
  }
  if (e.pedidos) {
    const total = activos.reduce((s, p) => s + p.total, 0);
    const aCobrar = activos.reduce((s, p) => s + p.aCobrar, 0);
    const vencido = activos.reduce((s, p) => s + p.vencido, 0);
    out.push({ entidad: "cobrado", valor: pesos(Math.max(0, total - aCobrar)), detalle: total > 0 ? `de ${pesos(total)} vendido` : null, href: "#pedidos" });
    out.push({ entidad: "porCobrar", valor: pesos(aCobrar), detalle: vencido > 0 ? `${pesos(vencido)} vencido` : aCobrar > 0 ? "Al día" : null, href: "#pedidos" });
  }
  return out;
}
