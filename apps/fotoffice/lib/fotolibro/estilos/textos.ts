import type { Medidas, TextoDelEstilo, TipoPliego, Zona } from "./tipos";

/** Milímetros a puntos tipográficos. */
export const pt = (mm: number) => (mm * 72) / 25.4;

type Opciones = {
  titulo: string;
  texto: string;
  color: string;
  acento?: string;
  /** Ejemplos que se muestran en el catálogo. */
  ejemplos: { titulo: string; subtitulo?: string; fecha?: string; frase?: string };
  /** Escala del título respecto del alto de la página (0.1 = 10%). */
  escalaTitulo?: number;
  mayusculasSubtitulo?: boolean;
  /** Dónde va el título en la página de apertura: centrado (por defecto) o arriba. */
  posicion?: "centro" | "arriba";
};

/**
 * Los títulos de siempre: en la página izquierda del pliego de apertura, el título grande, un
 * subtítulo y la fecha; en la página derecha del pliego de cierre, una frase.
 */
export function textosClasicos(o: Opciones) {
  return (tipo: TipoPliego, m: Medidas): TextoDelEstilo[] => {
    const w = m.anchoMm / 2;
    const h = m.altoMm;
    const margen = w * 0.1;
    const t = h * (o.escalaTitulo ?? 0.1);
    const y0 = o.posicion === "arriba" ? h * 0.1 : h * 0.3;
    if (tipo === "apertura") {
      const out: TextoDelEstilo[] = [
        { rol: "titulo", x: margen, y: y0, w: w - 2 * margen, h: t * 1.5, fuente: o.titulo, puntos: pt(t), color: o.color, alineacion: "center", ejemplo: o.ejemplos.titulo },
      ];
      if (o.ejemplos.subtitulo !== undefined) {
        out.push({
          rol: "subtitulo",
          x: margen,
          y: y0 + t * 1.6,
          w: w - 2 * margen,
          h: t * 0.7,
          fuente: o.texto,
          puntos: pt(t * 0.32),
          color: o.acento ?? o.color,
          alineacion: "center",
          mayusculas: o.mayusculasSubtitulo ?? true,
          ejemplo: o.ejemplos.subtitulo,
        });
      }
      if (o.ejemplos.fecha !== undefined) {
        out.push({ rol: "fecha", x: margen, y: y0 + t * 2.35, w: w - 2 * margen, h: t * 0.6, fuente: o.texto, puntos: pt(t * 0.26), color: o.color, alineacion: "center", ejemplo: o.ejemplos.fecha });
      }
      return out;
    }
    if (tipo === "cierre" && o.ejemplos.frase !== undefined) {
      return [{ rol: "frase", x: w + margen, y: h * 0.12, w: w - 2 * margen, h: t * 1.4, fuente: o.titulo, puntos: pt(t * 0.55), color: o.color, alineacion: "center", ejemplo: o.ejemplos.frase }];
    }
    return [];
  };
}

/** La zona que deja libres los títulos: en la apertura las fotos van abajo del título, en el cierre abajo de la frase. */
export function zonaClasica(extra: Partial<Zona> = {}, posicion: "centro" | "arriba" = "centro") {
  return (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> => {
    if (tipo === "apertura" && lado === "izq") return { ...extra, arriba: m.altoMm * (posicion === "arriba" ? 0.42 : 0.62) };
    if (tipo === "cierre" && lado === "der") return { ...extra, arriba: m.altoMm * 0.3 };
    return extra;
  };
}
