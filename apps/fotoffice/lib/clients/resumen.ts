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

/** Los paneles que despliegan los cuadros (el dinero abre el de pedidos). */
export type PanelDeResumen = "consultas" | "cotizaciones" | "pedidos" | "contratos" | "proyectos";

export type CuadroDeResumen = {
  entidad: Entidad;
  valor: string;
  detalle: string | null;
  panel: PanelDeResumen;
  /** En cero (hoy se dibuja igual; queda para quien quiera distinguirlo). */
  vacio: boolean;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function cuadrosDelResumen(e: EntradaResumen, pesos: (n: number) => string): CuadroDeResumen[] {
  const out: CuadroDeResumen[] = [];
  if (e.consultas) {
    out.push({ entidad: "consulta", valor: `${e.consultas.cantidad}${e.consultas.hayMas ? "+" : ""}`, detalle: null, panel: "consultas", vacio: e.consultas.cantidad === 0 });
  }
  if (e.cotizaciones) {
    const aceptadas = e.cotizaciones.filter((c) => c.estado === "ACEPTADO").length;
    out.push({ entidad: "cotizacion", valor: String(e.cotizaciones.length), detalle: aceptadas > 0 ? plural(aceptadas, "aceptada", "aceptadas") : null, panel: "cotizaciones", vacio: e.cotizaciones.length === 0 });
  }
  // Los pedidos cancelados cuentan como pedido pero no suman dinero.
  const activos = e.pedidos?.filter((p) => p.estado !== "CANCELADO") ?? [];
  if (e.pedidos) {
    const enCurso = activos.filter((p) => p.estado === "CONFIRMADO" || p.estado === "EN_CURSO").length;
    out.push({ entidad: "pedido", valor: String(e.pedidos.length), detalle: enCurso > 0 ? `${enCurso} en curso` : null, panel: "pedidos", vacio: e.pedidos.length === 0 });
  }
  if (e.contratos) {
    const firmados = e.contratos.filter((c) => c.estado === "FIRMADO").length;
    out.push({ entidad: "contrato", valor: String(e.contratos.length), detalle: firmados > 0 ? plural(firmados, "firmado", "firmados") : null, panel: "contratos", vacio: e.contratos.length === 0 });
  }
  if (e.proyectos) {
    const enCurso = e.proyectos.filter((p) => p.estado === "EN_CURSO").length;
    out.push({ entidad: "proyecto", valor: String(e.proyectos.length), detalle: enCurso > 0 ? `${enCurso} en curso` : null, panel: "proyectos", vacio: e.proyectos.length === 0 });
  }
  if (e.pedidos) {
    const total = activos.reduce((s, p) => s + p.total, 0);
    const aCobrar = activos.reduce((s, p) => s + p.aCobrar, 0);
    const vencido = activos.reduce((s, p) => s + p.vencido, 0);
    out.push({ entidad: "cobrado", valor: pesos(Math.max(0, total - aCobrar)), detalle: total > 0 ? `de ${pesos(total)} vendido` : null, panel: "pedidos", vacio: total - aCobrar <= 0 });
    out.push({ entidad: "porCobrar", valor: pesos(aCobrar), detalle: vencido > 0 ? `${pesos(vencido)} vencido` : aCobrar > 0 ? "Al día" : null, panel: "pedidos", vacio: aCobrar <= 0 });
  }
  return out;
}
