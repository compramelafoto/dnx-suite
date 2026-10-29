import type { TemplateV2Block } from "@repo/template-editor-core";
import { esBloqueAutomatico, type Lienzo } from "./bloques";
import { fotosSinOriginal, ladosDe, type EstadoFotolibro } from "./estado";

/**
 * La revisión antes de mandar el libro al laboratorio: lo que suele salir mal y se descubre
 * cuando ya está impreso. Los **errores** frenan la exportación; los **avisos** se pueden aceptar.
 */

export type Problema = {
  nivel: "error" | "aviso";
  /** Pliego al que lleva el clic (-1 = tapa, null = todo el libro). */
  pliego: number | null;
  texto: string;
};

/** Debajo de esto se nota que la foto está estirada; debajo del mínimo, se ve pixelada. */
export const PPP_BIEN = 200;
export const PPP_MINIMO = 120;
/** Distancia mínima al borde de corte para un texto (mm): menos, y la guillotina se lo come. */
const MARGEN_TEXTO_MM = 5;

const mm = (px: number, dpi: number) => (px * 25.4) / dpi;

/** Resolución a la que va a salir una foto en su marco (como en el panel lateral). */
export function pppDeFoto(bloque: TemplateV2Block, fotoW: number, fotoH: number, dpi: number): number {
  const crop = bloque.configJson.crop as { zoom?: number } | undefined;
  const zoom = Math.max(1, Number(crop?.zoom ?? 1));
  const ancho = bloque.layout.width / dpi;
  const alto = bloque.layout.height / dpi;
  // La foto cubre el marco: manda el lado que más la estira.
  return Math.round(Math.min(fotoW / ancho, fotoH / alto) / zoom);
}

export function revisarLibro(estado: EstadoFotolibro, bloques: readonly TemplateV2Block[], lienzo: Lienzo): Problema[] {
  const dpi = lienzo.dpi ?? 300;
  const out: Problema[] = [];
  const fotos = new Map(estado.fotos.map((f) => [f.id, f]));
  const medio = lienzo.width / 2;

  // Originales: sin ellos, la lámina sale sin esa foto.
  const sinOriginal = fotosSinOriginal(estado);
  if (sinOriginal.length) {
    const perdidas = sinOriginal.filter((f) => f.faltaOriginal).length;
    out.push({
      nivel: "error",
      pliego: null,
      texto: perdidas
        ? `A ${perdidas} ${perdidas === 1 ? "foto le falta" : "fotos les falta"} el original: volvé a subirlas.`
        : `Todavía se están subiendo ${sinOriginal.length} ${sinOriginal.length === 1 ? "original" : "originales"}.`,
    });
  }

  const usadas = new Map<string, number[]>();
  estado.pliegos.forEach((p, i) => {
    const ids = ladosDe(p).flatMap((l) => p[l].fotos);
    if (ids.length === 0) out.push({ nivel: "aviso", pliego: i, texto: `El pliego ${i + 1} está vacío.` });
    for (const id of ids) usadas.set(id, [...(usadas.get(id) ?? []), i]);
  });

  for (const b of bloques) {
    const pliego = b.pageIndex ?? 0;
    if (pliego >= estado.pliegos.length) continue;
    const { x, y, width: w, height: h } = b.layout;

    if (b.type === "IMAGE" && esBloqueAutomatico(b)) {
      const foto = fotos.get(String(b.configJson.fotoId ?? ""));
      if (foto) {
        const ppp = pppDeFoto(b, foto.w, foto.h, dpi);
        if (ppp < PPP_BIEN) {
          out.push({
            nivel: ppp < PPP_MINIMO ? "error" : "aviso",
            pliego,
            texto: `Pliego ${pliego + 1}: «${foto.nombre || "una foto"}» sale a ${ppp} ppp${ppp < PPP_MINIMO ? " y se va a ver pixelada" : ""}. Achicá su marco, sacale zoom o usá otra.`,
          });
        }
      }
      // Una foto chica partida por el doblez pierde lo del medio; las grandes, a propósito, no.
      if (x < medio - 2 && x + w > medio + 2 && w < lienzo.width * 0.6) {
        out.push({ nivel: "aviso", pliego, texto: `Pliego ${pliego + 1}: una foto queda partida por el lomo. Revisá que no caiga una cara en el doblez.` });
      }
    }

    if (b.type === "TEXT" && String(b.configJson.content ?? "").trim()) {
      const borde = Math.min(mm(x, dpi), mm(y, dpi), mm(lienzo.width - x - w, dpi), mm(lienzo.height - y - h, dpi));
      if (borde < MARGEN_TEXTO_MM) {
        out.push({ nivel: "aviso", pliego, texto: `Pliego ${pliego + 1}: un texto está a menos de ${MARGEN_TEXTO_MM} mm del borde y puede quedar cortado.` });
      }
      if (x < medio - 2 && x + w > medio + 2) {
        out.push({ nivel: "aviso", pliego, texto: `Pliego ${pliego + 1}: un texto cruza el lomo y va a quedar en el doblez.` });
      }
    }
  }

  const repetidas = [...usadas.entries()].filter(([, ps]) => ps.length > 1);
  if (repetidas.length) {
    out.push({
      nivel: "aviso",
      pliego: repetidas[0]![1][1] ?? null,
      texto: `${repetidas.length} ${repetidas.length === 1 ? "foto está" : "fotos están"} más de una vez en el libro.`,
    });
  }

  if (estado.tapa && !estado.tapa.fotoId && estado.tapa.diseno !== "tipografica") {
    out.push({ nivel: "aviso", pliego: -1, texto: "La tapa no tiene foto." });
  }

  // Primero lo que frena, después lo demás; dentro de cada uno, en el orden del libro.
  return out.sort((a, b) => (a.nivel === b.nivel ? (a.pliego ?? -2) - (b.pliego ?? -2) : a.nivel === "error" ? -1 : 1));
}
