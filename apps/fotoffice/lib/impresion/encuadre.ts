import { AJUSTES_NEUTROS } from "./ajustes";
import { cajaRotada } from "./geometria";
import { COLOR_BORDE_POR_OMISION, anguloTotal, type Encuadre, type Modo, type Orientacion, type Receta } from "./receta";

/**
 * Módulo PURO: las decisiones de encuadre de una copia (spec §5.5 y §6). Lo usan el editor (al
 * arrastrar, hacer zoom, girar) y el servidor (para validar). Todo en proporciones de la caja de
 * la foto ya girada (`cajaRotada`), igual que la receta.
 * `af` = ancho/alto de esa caja; `ap` = ancho/alto del papel ya orientado.
 *
 * Regla de ENCAJAR al mover y hacer zoom: en cada eje la foto o entra entera en el papel (hay
 * borde) o lo cubre (se corta). Nunca borde y corte en el mismo eje.
 */

export const UMBRAL_PERDIDA = 0.08;
export const ZOOM_MAX_RECORTAR = 6;
/** En ENCAJAR la foto se puede achicar hasta ocupar 1/4 del lado del papel. */
export const ACHIQUE_MAX_ENCAJAR = 4;
const TOLERANCIA_ASPECTO = 0.02;

export type Papel = { anchoMm: number; altoMm: number };
/** La foto ya derecha (EXIF aplicado), en píxeles del original; el papel como está guardado. */
export type Contexto = { foto: { ancho: number; alto: number }; papel: Papel };

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function papelOrientado(p: Papel, o: Orientacion): Papel {
  const corto = Math.min(p.anchoMm, p.altoMm);
  const largo = Math.max(p.anchoMm, p.altoMm);
  return o === "HORIZONTAL" ? { anchoMm: largo, altoMm: corto } : { anchoMm: corto, altoMm: largo };
}

export function orientacionDeFoto(ancho: number, alto: number): Orientacion {
  return ancho > alto ? "HORIZONTAL" : "VERTICAL";
}

/** Qué fracción del área de la foto se pierde si se recorta para llenar el papel. */
export function perdidaAlRecortar(af: number, ap: number): number {
  return 1 - Math.min(af / ap, ap / af);
}

/** Centrado y llenando el papel: se corta lo que sobra. */
export function encuadreQueLlena(af: number, ap: number): Encuadre {
  if (af > ap) {
    const ancho = ap / af;
    return { x: (1 - ancho) / 2, y: 0, ancho, alto: 1 };
  }
  const alto = af / ap;
  return { x: 0, y: (1 - alto) / 2, ancho: 1, alto };
}

/** Centrado y con la foto entera: lo que sobra del papel es borde. */
export function encuadreQueContiene(af: number, ap: number): Encuadre {
  if (af > ap) {
    const alto = af / ap;
    return { x: 0, y: (1 - alto) / 2, ancho: 1, alto };
  }
  const ancho = ap / af;
  return { x: (1 - ancho) / 2, y: 0, ancho, alto: 1 };
}

/** §5.5: la orientación sigue a la foto; si recortar pierde 8 % o menos, se recorta; si no, se encaja con borde blanco. */
export function propuestaAutomatica(fotoAncho: number, fotoAlto: number, papel: Papel): Receta {
  const orientacion = orientacionDeFoto(fotoAncho, fotoAlto);
  const p = papelOrientado(papel, orientacion);
  const af = fotoAncho / fotoAlto;
  const ap = p.anchoMm / p.altoMm;
  const modo: Modo = perdidaAlRecortar(af, ap) <= UMBRAL_PERDIDA ? "RECORTAR" : "ENCAJAR";
  return {
    version: 1,
    modo,
    orientacion,
    rotacion90: 0,
    enderezar: 0,
    encuadre: modo === "RECORTAR" ? encuadreQueLlena(af, ap) : encuadreQueContiene(af, ap),
    colorBorde: COLOR_BORDE_POR_OMISION,
    ajustes: { ...AJUSTES_NEUTROS },
    nitidez: null,
  };
}

export function aspectosDe(r: Receta, c: Contexto): { af: number; ap: number } {
  const caja = cajaRotada(c.foto.ancho, c.foto.alto, anguloTotal(r));
  const p = papelOrientado(c.papel, r.orientacion ?? "VERTICAL");
  return { af: caja.ancho / caja.alto, ap: p.anchoMm / p.altoMm };
}

function centrar(r: Receta, c: Contexto): Receta {
  const { af, ap } = aspectosDe(r, c);
  return { ...r, encuadre: r.modo === "RECORTAR" ? encuadreQueLlena(af, ap) : encuadreQueContiene(af, ap) };
}

/** Al mismo modo devuelve la MISMA receta (no recentra: tocar R estando en RECORTAR no pierde el encuadre). */
export function cambiarModo(r: Receta, modo: Modo, c: Contexto): Receta {
  if (r.modo === modo) return r;
  return centrar({ ...r, modo, colorBorde: r.colorBorde ?? COLOR_BORDE_POR_OMISION }, c);
}

export function cambiarOrientacion(r: Receta, c: Contexto): Receta {
  return centrar({ ...r, orientacion: r.orientacion === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL" }, c);
}

export function girar90(r: Receta, c: Contexto): Receta {
  return centrar({ ...r, rotacion90: ((r.rotacion90 + 90) % 360) as Receta["rotacion90"] }, c);
}

export function enderezarA(r: Receta, grados: number, c: Contexto): Receta {
  return centrar({ ...r, enderezar: acotar(Math.round(grados * 10) / 10, -10, 10) }, c);
}

/** Restablece modo, orientación, giro y encuadre; conserva ajustes y nitidez. */
export function volverALaPropuesta(r: Receta, c: Contexto): Receta {
  const p = propuestaAutomatica(c.foto.ancho, c.foto.alto, c.papel);
  return { ...p, ajustes: { ...r.ajustes }, nitidez: r.nitidez };
}

function limitarEje(pos: number, lado: number, modo: Modo): number {
  // RECORTAR, o ENCAJAR en un eje donde la foto cubre el papel: el papel queda dentro de la foto.
  if (modo === "RECORTAR" || lado <= 1) return acotar(pos, 0, Math.max(0, 1 - lado));
  // ENCAJAR en un eje con borde: la foto queda entera dentro del papel.
  return acotar(pos, 1 - lado, 0);
}

export function limitarEncuadre(e: Encuadre, modo: Modo): Encuadre {
  return { ...e, x: limitarEje(e.x, e.ancho, modo), y: limitarEje(e.y, e.alto, modo) };
}

/** `dx`/`dy`: cuánto se arrastró la FOTO, en fracciones del papel (positivo = derecha / abajo). */
export function moverEncuadre(e: Encuadre, dx: number, dy: number, modo: Modo): Encuadre {
  return limitarEncuadre({ ...e, x: e.x - dx * e.ancho, y: e.y - dy * e.alto }, modo);
}

/** `factor` > 1 acerca (el encuadre se achica), < 1 aleja. Mantiene el centro del papel y la proporción. */
export function zoomEncuadre(e: Encuadre, factor: number, modo: Modo, af: number, ap: number): Encuadre {
  const lleno = encuadreQueLlena(af, ap).ancho;
  const min = modo === "RECORTAR" ? lleno / ZOOM_MAX_RECORTAR : lleno;
  const max = modo === "RECORTAR" ? lleno : encuadreQueContiene(af, ap).ancho * ACHIQUE_MAX_ENCAJAR;
  const ancho = acotar(e.ancho / factor, min, max);
  const alto = (ancho * af) / ap;
  const cx = e.x + e.ancho / 2;
  const cy = e.y + e.alto / 2;
  return limitarEncuadre({ x: cx - ancho / 2, y: cy - alto / 2, ancho, alto }, modo);
}

/** 1 = la foto llena el papel; más de 1 acerca; menos de 1 (sólo ENCAJAR) achica. */
export function nivelDeZoom(e: Encuadre, af: number, ap: number): number {
  return encuadreQueLlena(af, ap).ancho / e.ancho;
}

export function conZoom(e: Encuadre, nivel: number, modo: Modo, af: number, ap: number): Encuadre {
  return zoomEncuadre(e, nivel / nivelDeZoom(e, af, ap), modo, af, ap);
}

export function rangoDeZoom(modo: Modo, af: number, ap: number): { min: number; max: number } {
  if (modo === "RECORTAR") return { min: 1, max: ZOOM_MAX_RECORTAR };
  return { min: encuadreQueLlena(af, ap).ancho / (encuadreQueContiene(af, ap).ancho * ACHIQUE_MAX_ENCAJAR), max: 1 };
}

/** El encuadre, sobre ESTA foto, tiene la proporción del papel (si no, el archivo saldría deformado). */
export function aspectoCoincide(foto: { ancho: number; alto: number }, r: Receta, papel: Papel): boolean {
  const caja = cajaRotada(foto.ancho, foto.alto, anguloTotal(r));
  const p = papelOrientado(papel, r.orientacion ?? "VERTICAL");
  const delEncuadre = (r.encuadre.ancho * caja.ancho) / (r.encuadre.alto * caja.alto);
  return Math.abs(delEncuadre / (p.anchoMm / p.altoMm) - 1) <= TOLERANCIA_ASPECTO;
}

/**
 * Dónde dibujar la foto (CSS, en px) para que el encuadre caiga justo sobre un papel de
 * `papelPx`. `caja` es la caja girada, relativa al papel; la imagen va centrada en la caja y
 * girada `rotacion` grados. Con la foto del tamaño que sea (la vista previa sirve igual).
 */
export function colocacionEnPantalla(
  r: Receta,
  foto: { ancho: number; alto: number },
  papelPx: { ancho: number; alto: number },
): { caja: { left: number; top: number; width: number; height: number }; foto: { width: number; height: number; rotacion: number } } {
  const rotacion = anguloTotal(r);
  const caja = cajaRotada(foto.ancho, foto.alto, rotacion);
  const width = papelPx.ancho / r.encuadre.ancho;
  const height = papelPx.alto / r.encuadre.alto;
  const escala = width / caja.ancho;
  return {
    caja: { left: -r.encuadre.x * width, top: -r.encuadre.y * height, width, height },
    foto: { width: foto.ancho * escala, height: foto.alto * escala, rotacion },
  };
}
