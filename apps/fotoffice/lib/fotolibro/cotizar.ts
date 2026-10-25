import { normalizarMedida } from "@/lib/precios-proveedor/clave";
import { redondearArriba, type TramoRedondeo } from "@/lib/precios-proveedor/redondeo";

/**
 * Precio de un fotolibro. Módulo PURO, en centavos.
 *
 * Igual en La Isla, Román y Copy Express: tapa (que define el modelo) + hoja × cantidad de
 * hojas, todo de la última lista aplicada del proveedor. El precio es ese costo con el margen de
 * fotolibros (DNX: ×3), redondeado como cualquier producto. La caja es opcional y se cotiza
 * aparte, con el mismo margen y su propio redondeo: va en un renglón propio. Ver
 * `docs/superpowers/specs/2026-10-21-listas-de-precios-de-proveedores-design.md` §9.
 *
 * `baseMinor` es el costo ya multiplicado por (1 + margen): así el mostrador puede calcular el
 * precio sin conocer el costo. `costoMinor` sólo viaja a quien puede ver costos.
 */

export type PiezaFotolibro = { medida: string; modelo: string | null; baseMinor: number; costoMinor: number | null };

export type OfertaFotolibro = {
  proveedorId: string;
  proveedor: string;
  vigencia: string;
  tapas: PiezaFotolibro[];
  hojas: PiezaFotolibro[];
  cajas: PiezaFotolibro[];
};

export type CatalogoFotolibro = {
  ofertas: OfertaFotolibro[];
  tramos: TramoRedondeo[];
  /** Fotos por hoja configuradas por medida ("30x45" → 10). Lo que falta sale de las por omisión. */
  fotosPorHoja: Record<string, number>;
  marginPct: number;
};

/** ×3 al público, como DNX Estudio hoy. */
export const MARGEN_FOTOLIBRO_POR_OMISION = 200;
/** De la planilla de cálculo de DNX Estudio. */
export const FOTOS_POR_HOJA_POR_OMISION: Record<string, number> = { "15x30": 8, "20x40": 4, "30x45": 10, "30x60": 5 };
export const MINIMO_HOJAS = 2;
export const MAXIMO_HOJAS = 100;
/** Sin tapa en la lista: la tapa flexible cuesta lo mismo que una hoja más (planilla de DNX). */
export const TAPA_FLEXIBLE = "Tapa flexible";

function areaCm2(medida: string): number | null {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(medida);
  return m ? Number(m[1]) * Number(m[2]) : null;
}

/** Lo configurado; si no, la planilla; si no, proporcional a la superficie (30x45 = 10 fotos). */
export function fotosPorHoja(medida: string, config: Readonly<Record<string, number>>): number {
  const m = normalizarMedida(medida) ?? medida;
  const configurado = config[m];
  if (Number.isFinite(configurado) && configurado! > 0) return configurado!;
  const planilla = FOTOS_POR_HOJA_POR_OMISION[m];
  if (planilla) return planilla;
  const area = areaCm2(m);
  return area === null ? 6 : Math.max(MINIMO_HOJAS, Math.round((10 * area) / 1350));
}

/** Una sugerencia: se puede cambiar. */
export function hojasSugeridas(fotos: number, porHoja: number): number {
  if (!Number.isFinite(fotos) || fotos <= 0 || porHoja <= 0) return MINIMO_HOJAS;
  return Math.min(MAXIMO_HOJAS, Math.max(MINIMO_HOJAS, Math.ceil(fotos / porHoja)));
}

function porMedida(a: string, b: string): number {
  return (areaCm2(a) ?? 0) - (areaCm2(b) ?? 0) || a.localeCompare(b);
}

/** Los dos productos del catálogo: "Fotolibro tapa flexible" y "Fotolibro tapa rígida". */
export type TipoTapa = "FLEXIBLE" | "RIGIDA";

export function esTapaFlexible(modelo: string): boolean {
  return modelo === TAPA_FLEXIBLE || /flexible/i.test(modelo);
}

/** Los modelos (tapas) del proveedor; con `tipo`, sólo los flexibles o sólo los rígidos. */
export function modelosDe(o: OfertaFotolibro, tipo: TipoTapa | null = null): string[] {
  const modelos = [...new Set(o.tapas.map((t) => t.modelo).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, "es"));
  if (o.hojas.length > 0 && !modelos.includes(TAPA_FLEXIBLE)) modelos.push(TAPA_FLEXIBLE);
  if (tipo === null) return modelos;
  return modelos.filter((m) => esTapaFlexible(m) === (tipo === "FLEXIBLE"));
}

function hojaDe(o: OfertaFotolibro, modelo: string, medida: string): PiezaFotolibro | null {
  return o.hojas.find((h) => h.medida === medida && h.modelo === modelo) ?? o.hojas.find((h) => h.medida === medida && !h.modelo) ?? null;
}

function tapaDe(o: OfertaFotolibro, modelo: string, medida: string): PiezaFotolibro | null {
  const explicita = o.tapas.find((t) => t.medida === medida && t.modelo === modelo);
  if (explicita) return explicita;
  return modelo === TAPA_FLEXIBLE ? hojaDe(o, modelo, medida) : null;
}

function cajaDe(o: OfertaFotolibro, modelo: string, medida: string): PiezaFotolibro | null {
  return o.cajas.find((c) => c.medida === medida && c.modelo === modelo) ?? o.cajas.find((c) => c.medida === medida && !c.modelo) ?? null;
}

/** Las medidas en las que ese modelo tiene tapa y hay hoja. */
export function medidasDe(o: OfertaFotolibro, modelo: string): string[] {
  const medidas = new Set([...o.tapas.map((t) => t.medida), ...o.hojas.map((h) => h.medida)]);
  return [...medidas].filter((m) => tapaDe(o, modelo, m) && hojaDe(o, modelo, m)).sort(porMedida);
}

export function tieneCaja(o: OfertaFotolibro, modelo: string, medida: string): boolean {
  return cajaDe(o, modelo, medida) !== null;
}

export type EleccionFotolibro = { proveedorId: string; modelo: string; medida: string; hojas: number; conCaja: boolean };

export type RenglonCotizado = { precioMinor: number; costoMinor: number | null; descripcion: string };

/** El libro (tapa + hojas) y, si se pidió, la caja en su propio renglón. */
export type CotizacionFotolibro =
  | ({ ok: true; vigencia: string; proveedor: string; caja: RenglonCotizado | null } & RenglonCotizado)
  | { ok: false; error: string };

function cotizarPiezas(piezas: { p: PiezaFotolibro; n: number }[], tramos: TramoRedondeo[]): { precioMinor: number; costoMinor: number | null } {
  const base = piezas.reduce((s, x) => s + x.p.baseMinor * x.n, 0);
  const conCosto = piezas.every((x) => x.p.costoMinor !== null);
  return {
    precioMinor: redondearArriba(Math.round(base * 100) / 100, tramos),
    costoMinor: conCosto ? piezas.reduce((s, x) => s + x.p.costoMinor! * x.n, 0) : null,
  };
}

export function cotizarFotolibro(c: CatalogoFotolibro, e: EleccionFotolibro): CotizacionFotolibro {
  const o = c.ofertas.find((x) => x.proveedorId === e.proveedorId);
  if (!o) return { ok: false, error: "Ese proveedor no tiene lista de fotolibros cargada." };
  if (!Number.isInteger(e.hojas) || e.hojas < 1 || e.hojas > MAXIMO_HOJAS) return { ok: false, error: `La cantidad de hojas tiene que ir de 1 a ${MAXIMO_HOJAS}.` };
  const tapa = tapaDe(o, e.modelo, e.medida);
  if (!tapa) return { ok: false, error: `${o.proveedor} no tiene tapa ${e.modelo} en ${e.medida}.` };
  const hoja = hojaDe(o, e.modelo, e.medida);
  if (!hoja) return { ok: false, error: `${o.proveedor} no tiene hojas de ${e.medida}.` };
  const caja = e.conCaja ? cajaDe(o, e.modelo, e.medida) : null;
  if (e.conCaja && !caja) return { ok: false, error: `${o.proveedor} no tiene caja para ${e.medida}.` };

  return {
    ok: true,
    ...cotizarPiezas([{ p: tapa, n: 1 }, { p: hoja, n: e.hojas }], c.tramos),
    vigencia: o.vigencia,
    proveedor: o.proveedor,
    descripcion: `Fotolibro ${e.modelo} ${e.medida} · ${e.hojas} ${e.hojas === 1 ? "hoja" : "hojas"} (${o.proveedor})`,
    caja: caja ? { ...cotizarPiezas([{ p: caja, n: 1 }], c.tramos), descripcion: `Caja para fotolibro ${e.modelo} ${e.medida} (${o.proveedor})` } : null,
  };
}

export type FilaSugerencia = { medida: string; fotosPorHoja: number; hojas: number; precioMinor: number };

/** Todas las medidas del modelo, con las hojas que harían falta para esas fotos y su precio. */
export function tablaSugerencias(c: CatalogoFotolibro, proveedorId: string, modelo: string, fotos: number): FilaSugerencia[] {
  const o = c.ofertas.find((x) => x.proveedorId === proveedorId);
  if (!o) return [];
  return medidasDe(o, modelo).flatMap((medida) => {
    const porHoja = fotosPorHoja(medida, c.fotosPorHoja);
    const hojas = hojasSugeridas(fotos, porHoja);
    const r = cotizarFotolibro(c, { proveedorId, modelo, medida, hojas, conCaja: false });
    return r.ok ? [{ medida, fotosPorHoja: porHoja, hojas, precioMinor: r.precioMinor }] : [];
  });
}
