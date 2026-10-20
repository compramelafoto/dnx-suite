import { SEGUNDOS_LATIDO } from "../constants";
import { CLASES_SIN_SENAL, type ClaseCuadro } from "./clasificador";

export const SEGUNDOS_IMAGEN_PARA_REINICIAR = 3;
export const SEGUNDOS_QUIETA_CONGELADA = 60;
/** Tramos sin señal más cortos no se guardan (un parpadeo no le sirve a nadie). */
export const MIN_SEGUNDOS_TRAMO = 10;

export type ClaseSinSenal = "SIN_SENAL_CALIBRADA" | "NEGRO" | "AZUL" | "NIEVE" | "CONGELADA";
export type TramoSinSenal = { desde: number; hasta: number; clase: ClaseSinSenal };

export type EstadoCorte = {
  /** Próximo segundo a procesar (= segundos ya procesados). */
  seg: number;
  imagenSeguida: number;
  quietaDesde: number | null;
  sinSenalDesde: number | null;
  claseSinSenal: ClaseSinSenal | null;
  primeraImagenSeg: number | null;
  ultimaImagenSeg: number | null;
  tramos: TramoSinSenal[];
};

export type ResumenCorte = {
  duracionSeg: number;
  primeraImagenSeg: number | null;
  ultimaImagenSeg: number | null;
  sinImagen: boolean;
  tramos: TramoSinSenal[];
};

export function estadoInicial(): EstadoCorte {
  return { seg: 0, imagenSeguida: 0, quietaDesde: null, sinSenalDesde: null, claseSinSenal: null, primeraImagenSeg: null, ultimaImagenSeg: null, tramos: [] };
}

export function latidoDebido(seg: number): boolean {
  return seg > 0 && seg % SEGUNDOS_LATIDO === 0;
}

function registrarTramo(tramos: TramoSinSenal[], t: TramoSinSenal): TramoSinSenal[] {
  return t.hasta - t.desde + 1 >= MIN_SEGUNDOS_TRAMO ? [...tramos, t] : tramos;
}

/** Suma `n` segundos de imagen que terminan en `fin`; cierra el tramo sin señal si corresponde. */
function sumarImagen(e: EstadoCorte, n: number, fin: number): EstadoCorte {
  const imagenSeguida = e.imagenSeguida + n;
  let { primeraImagenSeg, sinSenalDesde, claseSinSenal, tramos } = e;
  if (primeraImagenSeg === null && imagenSeguida >= SEGUNDOS_IMAGEN_PARA_REINICIAR) primeraImagenSeg = fin - imagenSeguida + 1;
  if (sinSenalDesde !== null && imagenSeguida >= SEGUNDOS_IMAGEN_PARA_REINICIAR) {
    tramos = registrarTramo(tramos, { desde: sinSenalDesde, hasta: fin - imagenSeguida, clase: claseSinSenal ?? "NEGRO" });
    sinSenalDesde = null;
    claseSinSenal = null;
  }
  const ultimaImagenSeg = imagenSeguida >= SEGUNDOS_IMAGEN_PARA_REINICIAR ? fin : e.ultimaImagenSeg;
  return { ...e, imagenSeguida, primeraImagenSeg, ultimaImagenSeg, sinSenalDesde, claseSinSenal, tramos };
}

export function avanzarSegundo(
  anterior: EstadoCorte,
  clase: ClaseCuadro,
  minutosSinSenal: number,
): { estado: EstadoCorte; cortar: boolean; sinImagenHaceSeg: number | null } {
  const t = anterior.seg;
  let e: EstadoCorte = { ...anterior, seg: t + 1 };

  if (clase === "QUIETA") {
    const desde = e.quietaDesde ?? t;
    e = { ...e, quietaDesde: desde };
    if (t - desde + 1 >= SEGUNDOS_QUIETA_CONGELADA && e.sinSenalDesde === null) {
      e = { ...e, sinSenalDesde: desde, claseSinSenal: "CONGELADA", imagenSeguida: 0 };
    }
  } else {
    if (e.quietaDesde !== null) {
      const corrida = t - e.quietaDesde;
      // Una escena quieta corta era imagen; una larga ya quedó como congelada.
      if (corrida < SEGUNDOS_QUIETA_CONGELADA) e = sumarImagen(e, corrida, t - 1);
      e = { ...e, quietaDesde: null };
    }
    if (clase === "IMAGEN") {
      e = sumarImagen(e, 1, t);
    } else if (CLASES_SIN_SENAL.has(clase)) {
      e = { ...e, imagenSeguida: 0 };
      if (e.sinSenalDesde === null) e = { ...e, sinSenalDesde: t, claseSinSenal: clase as ClaseSinSenal };
    }
  }

  const sinImagenHaceSeg = e.sinSenalDesde === null ? null : t - e.sinSenalDesde + 1;
  const cortar = sinImagenHaceSeg !== null && sinImagenHaceSeg >= minutosSinSenal * 60;
  return { estado: e, cortar, sinImagenHaceSeg };
}

export function cerrarCorte(original: EstadoCorte): ResumenCorte {
  let e = original;
  const ultimo = e.seg - 1;
  if (e.quietaDesde !== null && e.seg - e.quietaDesde < SEGUNDOS_QUIETA_CONGELADA) {
    e = sumarImagen({ ...e, quietaDesde: null }, e.seg - e.quietaDesde, ultimo);
  }
  let tramos = e.tramos;
  if (e.sinSenalDesde !== null) tramos = registrarTramo(tramos, { desde: e.sinSenalDesde, hasta: ultimo, clase: e.claseSinSenal ?? "NEGRO" });
  return {
    duracionSeg: e.seg,
    primeraImagenSeg: e.primeraImagenSeg,
    ultimaImagenSeg: e.ultimaImagenSeg,
    sinImagen: e.primeraImagenSeg === null,
    tramos,
  };
}
