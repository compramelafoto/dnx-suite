/**
 * Preparar para laboratorio: reglas puras del pedido (medidas reales, opciones del catálogo y
 * renglones del ticket, uno por producto del catálogo). Módulo PURO.
 */
import { cotizarCopias, nombreDelPlazo, type PedidoLinea, type ProductoCopia } from "@/lib/impresiones/catalogo-copias";
import type { Papel } from "./encuadre";

export const FOTOS_MAX_LAB = 200;
export const CANTIDAD_MAX_LAB = 99;

export type PlazoLab = "MANANA" | "SEMANA";
export type PapelLab = "MATE" | "BRILLO";

const MEDIDAS_REALES: Record<string, Papel> = {
  "10x15": { anchoMm: 102, altoMm: 152 },
  "13x18": { anchoMm: 127, altoMm: 180 },
  "15x21": { anchoMm: 152, altoMm: 210 },
  "20x30": { anchoMm: 203, altoMm: 300 },
  "25x38": { anchoMm: 254, altoMm: 380 },
};

export function medidaEnMm(medida: string): Papel | null {
  const real = MEDIDAS_REALES[medida];
  if (real) return { ...real };
  const m = medida.match(/^(\d{1,3})x(\d{1,3})$/);
  if (!m) return null;
  return { anchoMm: Number(m[1]) * 10, altoMm: Number(m[2]) * 10 };
}

const TEXTO_PLAZO_ERROR: Record<PlazoLab, string> = { MANANA: "para mañana", SEMANA: "próxima semana" };

export type PiezaLab = { originalId: string; medida: string; plazo: PlazoLab; papel: PapelLab; cantidad: number };
export type OpcionesLab = { medidas: { medida: string; plazos: PlazoLab[] }[]; papeles: PapelLab[] };

const lados = (medida: string): [number, number] => {
  const [a, b] = medida.split("x").map(Number);
  return [Math.min(a, b), Math.max(a, b)];
};

export function opcionesDelCatalogo(catalogo: ProductoCopia[], papeles: { mate: boolean; brillo: boolean } | null): OpcionesLab {
  const porMedida = new Map<string, Set<PlazoLab>>();
  for (const p of catalogo) {
    if (p.plazo === "INSTANTANEA") continue;
    if (!porMedida.has(p.medida)) porMedida.set(p.medida, new Set());
    porMedida.get(p.medida)!.add(p.plazo);
  }
  const medidas = [...porMedida.entries()]
    .map(([medida, set]) => ({ medida, plazos: (["MANANA", "SEMANA"] as PlazoLab[]).filter((p) => set.has(p)) }))
    .sort((x, y) => {
      const [xc, xl] = lados(x.medida);
      const [yc, yl] = lados(y.medida);
      return xc - yc || xl - yl;
    });
  const lista: PapelLab[] = [];
  if (!papeles || papeles.mate) lista.push("MATE");
  if (!papeles || papeles.brillo) lista.push("BRILLO");
  return { medidas, papeles: lista };
}

export type RenglonLab = { productId: string; cantidad: number; precioUnitario: number; proveedorId: string | null; claves: string[] };

export function renglonesDelPedido(
  piezas: PiezaLab[],
  catalogo: ProductoCopia[],
  proveedorDeProducto: Map<string, string | null>,
): { ok: true; renglones: RenglonLab[]; plazoFinal: Map<string, PlazoLab> } | { ok: false; error: string } {
  const grupos = new Map<string, { medida: string; plazo: PlazoLab; cantidad: number; ids: string[] }>();
  for (const p of piezas) {
    const k = `${p.medida}|${p.plazo}`;
    const g = grupos.get(k) ?? { medida: p.medida, plazo: p.plazo, cantidad: 0, ids: [] };
    g.cantidad += p.cantidad;
    g.ids.push(p.originalId);
    grupos.set(k, g);
  }
  const lista = [...grupos.values()];
  const lineas: PedidoLinea[] = lista.map((g) => ({ medida: g.medida, plazo: g.plazo, cantidad: g.cantidad }));
  const cot = cotizarCopias(lineas, catalogo);
  if (!cot.ok) {
    // cotizarCopias corta en la primera línea sin precio; `falta` es «medida plazo».
    const medida = cot.falta.split(" ")[0];
    const grupo = lista.find((g) => `${g.medida} ${nombreDelPlazo(g.plazo)}` === cot.falta);
    const plazo = grupo ? TEXTO_PLAZO_ERROR[grupo.plazo as PlazoLab] ?? "" : "";
    return { ok: false, error: `No hay precio para ${medida} ${plazo} en el catálogo.` };
  }
  const plazoFinal = new Map<string, PlazoLab>();
  const porProducto = new Map<string, RenglonLab>();
  cot.lineas.forEach((l, i) => {
    const g = lista[i];
    const pf: PlazoLab = l.plazo === "SEMANA" ? "SEMANA" : "MANANA";
    for (const id of g.ids) plazoFinal.set(id, pf);
    const clave = `${l.medida}|${pf}`;
    // Pocas copias: cotizarCopias devuelve el producto instantáneo, pero el laboratorio es el del
    // producto «para mañana» de esa medida (el de la instantánea no cuenta).
    const elegido = catalogo.find((p) => p.id === l.productoId);
    const pocasCopias = elegido?.plazo === "INSTANTANEA" && g.plazo !== "INSTANTANEA";
    const manana = pocasCopias ? catalogo.find((p) => p.medida === l.medida && p.plazo === "MANANA") : undefined;
    const prov = manana
      ? (proveedorDeProducto.get(manana.id) ?? manana.proveedorId)
      : pocasCopias
        ? l.proveedorId
        : (proveedorDeProducto.get(l.productoId) ?? l.proveedorId);
    const r = porProducto.get(l.productoId);
    if (r) {
      r.cantidad += l.cantidad;
      if (!r.claves.includes(clave)) r.claves.push(clave);
    } else {
      porProducto.set(l.productoId, { productId: l.productoId, cantidad: l.cantidad, precioUnitario: l.precioUnitario, proveedorId: prov, claves: [clave] });
    }
  });
  return { ok: true, renglones: [...porProducto.values()], plazoFinal };
}
