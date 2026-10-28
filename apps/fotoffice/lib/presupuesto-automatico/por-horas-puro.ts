import { CUANTO_COBRO_ROUTE_FACTOR, straightLineKm } from "@repo/cuanto-cobro-core";

/**
 * Presupuesto por horas (spec 2026-10-28): reglas del estudio para armar la receta de cualquier
 * evento o sesión sin propuesta modelo, a partir de las horas de cobertura. Módulo PURO.
 */

export type AjustesPorHoras = {
  encendido: boolean;
  /** Horas de edición por cada hora de cobertura. */
  edicionPorHora: number;
  /** Fotos por hora: sólo para el cálculo interno (desgaste de cámara). Nunca se promete. */
  disparosPorHora: number;
  minimoFotosEvento: number;
  minimoFotosSesion: number;
  /** Pesos por km de distancia (ida + vuelta). */
  pesosPorKm: number;
  maxKm: number;
  partida: { direccion: string; lat: number | null; lon: number | null };
  /** Porcentaje de la hora de Daniel que cuesta un segundo fotógrafo, por hora de cobertura. */
  segundoFotografoPct: number;
  /** Desde cuántos invitados (más de) se recomienda un segundo fotógrafo. */
  invitadosSegundoFotografo: number;
  /** Categorías que son sesiones de fotos (el resto son eventos). */
  categoriasSesion: string[];
  incluye: string;
  opcionalesTexto: string;
};

export const AJUSTES_POR_HORAS_POR_OMISION: AjustesPorHoras = {
  encendido: false,
  edicionPorHora: 2,
  disparosPorHora: 575,
  minimoFotosEvento: 400,
  minimoFotosSesion: 70,
  pesosPorKm: 3000,
  maxKm: 200,
  partida: { direccion: "García del Cossio 2050, Funes, Santa Fe", lat: null, lon: null },
  segundoFotografoPct: 30,
  invitadosSegundoFotografo: 200,
  categoriasSesion: [],
  incluye: "Galería online",
  opcionalesTexto: "Opcionales para después: impresiones y fotolibro.",
};

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function numero(v: unknown, omision: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : Number.NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : omision;
}
const coordenada = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const texto = (v: unknown, omision: string, max = 500): string => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : omision);

export function normalizarAjustesPorHoras(json: unknown): AjustesPorHoras {
  const o = AJUSTES_POR_HORAS_POR_OMISION;
  if (!esObjeto(json)) return { ...o, partida: { ...o.partida }, categoriasSesion: [] };
  const p = esObjeto(json.partida) ? json.partida : {};
  return {
    encendido: json.encendido === true,
    edicionPorHora: numero(json.edicionPorHora, o.edicionPorHora, 0, 20),
    disparosPorHora: numero(json.disparosPorHora, o.disparosPorHora, 1, 5000),
    minimoFotosEvento: numero(json.minimoFotosEvento, o.minimoFotosEvento, 1, 10000),
    minimoFotosSesion: numero(json.minimoFotosSesion, o.minimoFotosSesion, 1, 10000),
    pesosPorKm: numero(json.pesosPorKm, o.pesosPorKm, 0, 1_000_000),
    maxKm: numero(json.maxKm, o.maxKm, 1, 5000),
    partida: { direccion: texto(p.direccion, o.partida.direccion, 300), lat: coordenada(p.lat), lon: coordenada(p.lon) },
    segundoFotografoPct: numero(json.segundoFotografoPct, o.segundoFotografoPct, 0, 300),
    invitadosSegundoFotografo: numero(json.invitadosSegundoFotografo, o.invitadosSegundoFotografo, 0, 100000),
    categoriasSesion: Array.isArray(json.categoriasSesion)
      ? json.categoriasSesion.filter((c): c is string => typeof c === "string" && c.length > 0 && c.length <= 64).slice(0, 50)
      : [],
    incluye: texto(json.incluye, o.incluye),
    opcionalesTexto: texto(json.opcionalesTexto, o.opcionalesTexto),
  };
}

/** Horas de cobertura: de 0,5 a 24, redondeadas a media hora. Acepta "3,5". */
export function horasValidas(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim().replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(n)) return null;
  const redondeada = Math.round(n * 2) / 2;
  return redondeada >= 0.5 && redondeada <= 24 ? redondeada : null;
}

export type Punto = { lat: number; lon: number };

/** Km por calle (línea recta × 1,3), con un decimal. Más lejos que `maxKm` o sin datos → null. */
export function kmDeDistancia(origen: Punto | null, destino: Punto | null, maxKm: number): number | null {
  if (!origen || !destino) return null;
  const km = Math.round(straightLineKm(origen.lat, origen.lon, destino.lat, destino.lon) * CUANTO_COBRO_ROUTE_FACTOR * 10) / 10;
  return km <= maxKm ? km : null;
}

export type Receta = {
  coberturaHoras: number;
  edicionHoras: number;
  disparos: number;
  /** Pesos a sumar al precio (sin margen). `null`: no se pudo calcular. */
  trasladoPesos: number | null;
  minimoFotos: number;
  nombre: string;
  descripcion: string;
};

const horasEnTexto = (h: number) => `${String(h).replace(".", ",")} ${h === 1 ? "hora" : "horas"}`;

export function recetaPorHoras(p: { horas: number; esSesion: boolean; km: number | null; enElEstudio: boolean; ajustes: AjustesPorHoras }): Receta {
  const a = p.ajustes;
  const minimoFotos = p.esSesion ? a.minimoFotosSesion : a.minimoFotosEvento;
  const trasladoPesos = p.enElEstudio ? 0 : p.km === null ? null : Math.round(p.km * a.pesosPorKm);
  return {
    coberturaHoras: p.horas,
    edicionHoras: p.horas * a.edicionPorHora,
    disparos: Math.round(p.horas * a.disparosPorHora),
    trasladoPesos,
    minimoFotos,
    nombre: p.esSesion ? `Sesión de fotos de ${horasEnTexto(p.horas)}` : `Cobertura fotográfica de ${horasEnTexto(p.horas)}`,
    descripcion: `Incluye ${a.incluye.charAt(0).toLowerCase()}${a.incluye.slice(1)} con un mínimo de ${minimoFotos} fotos editadas. ${a.opcionalesTexto}`,
  };
}

/** Precio del segundo fotógrafo, redondeado a $100. Sin valor de la hora → null. */
export function precioSegundoFotografo(valorHora: number | null, horas: number, pct: number): number | null {
  if (valorHora === null || !Number.isFinite(valorHora) || valorHora <= 0 || horas <= 0) return null;
  const precio = Math.round((valorHora * horas * pct) / 100 / 100) * 100;
  return precio > 0 ? precio : null;
}

export function llevaSegundoFotografo(p: { grupo: string; esSesion: boolean; invitados: number | null; umbral: number }): boolean {
  if (p.esSesion) return false;
  if (p.grupo === "BODA") return true;
  return p.invitados !== null && p.invitados > p.umbral;
}
