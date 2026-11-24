/**
 * Buscador y filtros de «Para imprimir» en el panel «Impresiones». Puro (sin Prisma): lo usa el
 * componente y se prueba con node:test.
 *
 * El texto busca en todo lo que se ve del pedido y algo más: cliente, correo, teléfono, número de
 * pedido, álbum, medidas y acabados. Cada palabra tiene que aparecer en algún lado (sin importar
 * mayúsculas ni tildes): «juan 15x21» trae los pedidos de Juan con copias 15x21.
 */

import type { PedidoDelPanel } from "./panel";

export type EntregaDelFiltro = "TODAS" | "RETIRA_EN_LAB" | "LA_ENTREGAS_VOS";
export type EstadoDelFiltro = "TODOS" | "LISTOS" | "CON_PROBLEMA";
export type OrdenDelFiltro = "MAS_VIEJOS" | "MAS_NUEVOS" | "CLIENTE" | "MAS_COPIAS";

export type FiltroParaImprimir = {
  texto: string;
  album: string; // "" = todos
  medida: string; // "" = todas
  entrega: EntregaDelFiltro;
  /** "" = todos; si no, el id del laboratorio de retiro, o "SIN" para los que no retiran en ninguno. */
  laboratorio: string;
  estado: EstadoDelFiltro;
  /** Fechas de pago, "AAAA-MM-DD" en hora de Argentina; "" = sin límite. */
  desde: string;
  hasta: string;
  orden: OrdenDelFiltro;
};

export const FILTRO_VACIO: FiltroParaImprimir = {
  texto: "", album: "", medida: "", entrega: "TODAS", laboratorio: "", estado: "TODOS", desde: "", hasta: "", orden: "MAS_VIEJOS",
};

/** Cuántos filtros (sin contar el orden) están puestos. */
export function filtrosActivos(f: FiltroParaImprimir): number {
  return [
    f.texto.trim() !== "", f.album !== "", f.medida !== "", f.entrega !== "TODAS", f.laboratorio !== "",
    f.estado !== "TODOS", f.desde !== "", f.hasta !== "",
  ].filter(Boolean).length;
}

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soloDigitos = (s: string) => s.replace(/\D/g, "");

/** La fecha "AAAA-MM-DD" de un ISO en hora de Argentina. */
export function diaArgentino(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso));
}

function textoDelPedido(p: PedidoDelPanel): string {
  return normal(
    [
      p.cliente, p.email ?? "", p.telefono ?? "", `#${p.albumOrderId}`, `pedido ${p.albumOrderId}`, p.album,
      ...p.copias.map((c) => `${c.medida} ${c.acabado}`), p.motivo ?? "",
    ].join(" · "),
  );
}

/** ¿El pedido coincide con lo escrito? Cada palabra en algún lado; los números también contra el teléfono sin guiones. */
export function coincideConElTexto(p: PedidoDelPanel, texto: string): boolean {
  const palabras = normal(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const todo = textoDelPedido(p);
  const tel = soloDigitos(p.telefono ?? "");
  return palabras.every((w) => {
    if (todo.includes(w)) return true;
    // Un número («#123», «3454-073061»): el número de pedido exacto o parte del teléfono sin guiones.
    const numero = w.replace(/[#()+.-]/g, "");
    if (!/^\d+$/.test(numero)) return false;
    return String(p.albumOrderId) === numero || (numero.length >= 3 && tel.includes(numero));
  });
}

export function filtrarParaImprimir(pedidos: readonly PedidoDelPanel[], f: FiltroParaImprimir): PedidoDelPanel[] {
  const fuera = pedidos.filter((p) => {
    if (!coincideConElTexto(p, f.texto)) return false;
    if (f.album && p.album !== f.album) return false;
    if (f.medida && !p.copias.some((c) => c.medida === f.medida)) return false;
    if (f.entrega === "RETIRA_EN_LAB" && !p.retiraCliente) return false;
    if (f.entrega === "LA_ENTREGAS_VOS" && p.retiraCliente) return false;
    if (f.laboratorio === "SIN" && p.pickupLabContactId != null) return false;
    if (f.laboratorio && f.laboratorio !== "SIN" && String(p.pickupLabContactId) !== f.laboratorio) return false;
    if (f.estado === "LISTOS" && p.motivo != null) return false;
    if (f.estado === "CON_PROBLEMA" && p.motivo == null) return false;
    if (f.desde || f.hasta) {
      const dia = diaArgentino(p.pagadoAt);
      if (f.desde && dia < f.desde) return false;
      if (f.hasta && dia > f.hasta) return false;
    }
    return true;
  });
  const porFecha = (a: PedidoDelPanel, b: PedidoDelPanel) => a.pagadoAt.localeCompare(b.pagadoAt) || a.albumOrderId - b.albumOrderId;
  const orden: Record<OrdenDelFiltro, (a: PedidoDelPanel, b: PedidoDelPanel) => number> = {
    MAS_VIEJOS: porFecha,
    MAS_NUEVOS: (a, b) => -porFecha(a, b),
    CLIENTE: (a, b) => a.cliente.localeCompare(b.cliente, "es", { sensitivity: "base" }) || porFecha(a, b),
    MAS_COPIAS: (a, b) => b.totalCopias - a.totalCopias || porFecha(a, b),
  };
  return [...fuera].sort(orden[f.orden]);
}

/** Opciones de los desplegables, sacadas de los pedidos que hay (ordenadas). */
export function opcionesDelFiltro(pedidos: readonly PedidoDelPanel[]): { albumes: string[]; medidas: string[] } {
  const albumes = [...new Set(pedidos.map((p) => p.album).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const medidas = [...new Set(pedidos.flatMap((p) => p.copias.map((c) => c.medida)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  return { albumes, medidas };
}
