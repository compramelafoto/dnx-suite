/** Lo que manda el navegador, validado sin base ni sesión. Devuelve null ante cualquier duda. */
import { ID_VALIDO, extensionDeMime } from "./claves";
import { CALIDADES, MAX_BYTES_PARTE, MOTIVOS_FIN_DE_LA_ESTACION, SEGUNDOS_SIN_LATIDO, TOPE_SEGUNDOS, type Calidad, type TipoGrabacion } from "./constants";
import type { ArchivoDvd } from "./dvd";
import type { ClaseSinSenal, TramoSinSenal } from "./senal/corte";

export type EstadoVisible = "GRABANDO" | "COMPLETA" | "DESCARTADA" | "INTERRUMPIDA";

export function estadoVisible(g: { estado: string; ultimoLatidoAt: Date | null; iniciadaAt: Date }, ahora: Date): EstadoVisible {
  if (g.estado === "COMPLETA" || g.estado === "DESCARTADA") return g.estado;
  const ultimo = g.ultimoLatidoAt ?? g.iniciadaAt;
  return ahora.getTime() - ultimo.getTime() > SEGUNDOS_SIN_LATIDO * 1000 ? "INTERRUMPIDA" : "GRABANDO";
}

const esObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const entero = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const idONull = (x: unknown): x is string | null => x === null || (typeof x === "string" && ID_VALIDO.test(x));
const MAX_SEG = TOPE_SEGUNDOS + 600;

export type NuevaGrabacion = {
  tipo: TipoGrabacion;
  proyectoId: string | null;
  cassetteNumero: number | null;
  calidad: Calidad | null;
  mimeType: string;
  corregirProporcion: boolean;
  equipoId: string | null;
  dvdArchivos: ArchivoDvd[] | null;
};

export function validarNuevaGrabacion(x: unknown): NuevaGrabacion | null {
  if (!esObj(x)) return null;
  const { tipo, proyectoId, cassetteNumero, calidad, mimeType, corregirProporcion, equipoId, dvdArchivos } = x;
  if (tipo !== "VHS" && tipo !== "DVD") return null;
  if (!idONull(proyectoId) || !idONull(equipoId)) return null;
  if (cassetteNumero !== null && !entero(cassetteNumero, 1, 999)) return null;
  if (typeof corregirProporcion !== "boolean") return null;
  if (typeof mimeType !== "string" || mimeType.length > 100) return null;
  const ext = extensionDeMime(mimeType);
  if (tipo === "VHS") {
    if (ext !== "mp4" && ext !== "webm") return null;
    if (typeof calidad !== "string" || !(calidad in CALIDADES)) return null;
    if (dvdArchivos !== null) return null;
    return { tipo, proyectoId, cassetteNumero: cassetteNumero as number | null, calidad: calidad as Calidad, mimeType, corregirProporcion, equipoId, dvdArchivos: null };
  }
  if (ext !== "vob" || calidad !== null) return null;
  if (!Array.isArray(dvdArchivos) || dvdArchivos.length === 0 || dvdArchivos.length > 200) return null;
  const archivos: ArchivoDvd[] = [];
  for (const a of dvdArchivos) {
    if (!esObj(a) || typeof a.nombre !== "string" || !/^VTS_\d{2}_[1-9]\.VOB$/i.test(a.nombre) || !entero(a.bytes, 1, 2 ** 31)) return null;
    archivos.push({ nombre: a.nombre, bytes: a.bytes as number });
  }
  return { tipo, proyectoId, cassetteNumero: cassetteNumero as number | null, calidad: null, mimeType, corregirProporcion, equipoId, dvdArchivos: archivos };
}

export type PedidoParte = { grabacionId: string; tramo: number; indice: number; bytes: number };

export function validarPedidoParte(x: unknown): PedidoParte | null {
  if (!esObj(x)) return null;
  const { grabacionId, tramo, indice, bytes } = x;
  if (typeof grabacionId !== "string" || !ID_VALIDO.test(grabacionId)) return null;
  if (!entero(tramo, 1, 999) || !entero(indice, 0, 999_999) || !entero(bytes, 1, MAX_BYTES_PARTE)) return null;
  return { grabacionId, tramo, indice, bytes };
}

const CLASES: ReadonlySet<string> = new Set<ClaseSinSenal>(["SIN_SENAL_CALIBRADA", "NEGRO", "AZUL", "NIEVE", "CONGELADA"]);
export type TramoGuardado = TramoSinSenal & { tramo: number };
export type Latido = {
  /** Tramo al que se refieren duración y última imagen. */
  tramo: number;
  duracionSeg: number;
  primeraImagenSeg: number | null;
  ultimaImagenSeg: number | null;
  sinImagen: boolean;
  tramosSinSenal: TramoGuardado[];
};

export function validarLatido(x: unknown): Latido | null {
  if (!esObj(x)) return null;
  const { tramo, duracionSeg, primeraImagenSeg, ultimaImagenSeg, sinImagen, tramosSinSenal } = x;
  if (!entero(tramo, 1, 999) || !entero(duracionSeg, 0, MAX_SEG) || typeof sinImagen !== "boolean") return null;
  if (primeraImagenSeg !== null && !entero(primeraImagenSeg, 0, MAX_SEG)) return null;
  if (ultimaImagenSeg !== null && !entero(ultimaImagenSeg, 0, MAX_SEG)) return null;
  if (!Array.isArray(tramosSinSenal) || tramosSinSenal.length > 2000) return null;
  const tramos: TramoGuardado[] = [];
  for (const t of tramosSinSenal) {
    if (!esObj(t) || !entero(t.tramo, 1, 999) || !entero(t.desde, 0, MAX_SEG) || !entero(t.hasta, 0, MAX_SEG)) return null;
    if ((t.hasta as number) < (t.desde as number) || typeof t.clase !== "string" || !CLASES.has(t.clase)) return null;
    tramos.push({ tramo: t.tramo as number, desde: t.desde as number, hasta: t.hasta as number, clase: t.clase as ClaseSinSenal });
  }
  return {
    tramo,
    duracionSeg,
    primeraImagenSeg: primeraImagenSeg as number | null,
    ultimaImagenSeg: ultimaImagenSeg as number | null,
    sinImagen,
    tramosSinSenal: tramos,
  };
}

export type Cierre = Latido & { motivoFin: (typeof MOTIVOS_FIN_DE_LA_ESTACION)[number] };

export function validarCierre(x: unknown): Cierre | null {
  const latido = validarLatido(x);
  if (!latido || !esObj(x)) return null;
  const motivo = x.motivoFin;
  if (typeof motivo !== "string" || !(MOTIVOS_FIN_DE_LA_ESTACION as readonly string[]).includes(motivo)) return null;
  return { ...latido, motivoFin: motivo as Cierre["motivoFin"] };
}
