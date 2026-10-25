import type { TemplateV2Block } from "@repo/template-editor-core";
import type { EstadoFotolibro, Encuadre, FotoDelLibro } from "../modo/estado";
import { estiloPorId } from "../estilos/catalogo";
import type { Medidas, TextoDelEstilo } from "../estilos/tipos";
import { modeloTapaPorId, type ModeloTapa } from "./catalogo";
import { geometriaTapa, type GeometriaTapa, type Rect } from "./geometria";

/**
 * La tapa como bloques del editor, para verla en el Modo Fotolibro y para mandarla al laboratorio
 * con el mismo motor que los pliegos.
 *
 * No se guarda como una hoja más del diseño: tiene otra medida que los pliegos (el frente del Gold
 * Premium mide 305 × 345 mm) y el diseño tiene un solo tamaño de lienzo. Se arma siempre desde
 * `estado.tapa`, así que cambiar de modelo o de cantidad de hojas no deja nada viejo.
 */

export type LienzoTapa = { width: number; height: number; dpi: number };

const px = (mm: number, dpi: number) => (mm * dpi) / 25.4;

export function lienzoDeTapa(g: GeometriaTapa, dpi = 300): LienzoTapa {
  return { width: Math.round(px(g.pieza.ancho, dpi)), height: Math.round(px(g.pieza.alto, dpi)), dpi };
}

/** El marco de cada foto, en mm: cubre su cara y sigue por la demasía, que se dobla sobre el cartón. */
export function marcosDeTapa(modelo: ModeloTapa, g: GeometriaTapa): { tapa: Rect; contratapa: Rect | null } {
  const { ancho, alto } = g.pieza;
  if (modelo.tipo === "frente") return { tapa: { x: 0, y: 0, w: ancho, h: alto }, contratapa: null };
  if (modelo.tipo === "flexible") return { tapa: g.tapa, contratapa: g.contratapa };
  const lomo = g.lomo!;
  return {
    contratapa: { x: 0, y: 0, w: lomo.x, h: alto },
    tapa: { x: lomo.x + lomo.w, y: 0, w: ancho - lomo.x - lomo.w, h: alto },
  };
}

/** Lo que hace falta para armar la tapa de un libro, o null si todavía no tiene modelo elegido. */
export function tapaDelLibro(estado: EstadoFotolibro, hojas: number) {
  const modelo = modeloTapaPorId(estado.tapa?.modeloId);
  if (!modelo) return null;
  const geometria = geometriaTapa(modelo, hojas);
  return { modelo, geometria, lienzo: lienzoDeTapa(geometria) };
}

const ID_FOTO_TAPA = "tapa-foto";
const ID_FOTO_CONTRATAPA = "contratapa-foto";
export const esIdFotoDeTapa = (id: string): id is typeof ID_FOTO_TAPA | typeof ID_FOTO_CONTRATAPA =>
  id === ID_FOTO_TAPA || id === ID_FOTO_CONTRATAPA;

function bloqueFoto(id: string, foto: FotoDelLibro, marco: Rect, encuadre: Encuadre | null, dpi: number): TemplateV2Block {
  return {
    id,
    type: "IMAGE",
    pageIndex: 0,
    name: id === ID_FOTO_TAPA ? "Foto de tapa" : "Foto de contratapa",
    layout: { x: px(marco.x, dpi), y: px(marco.y, dpi), width: px(marco.w, dpi), height: px(marco.h, dpi), rotation: 0, zIndex: 10, opacity: 1, locked: false, visible: true },
    configJson: {
      src: foto.url,
      previewSrc: foto.vista,
      fit: "cover",
      srcWidth: foto.w,
      srcHeight: foto.h,
      fotoId: foto.id,
      ...(encuadre ? { crop: encuadre } : {}),
    },
  };
}

/** El título del estilo para la portada, o uno clásico si el libro no tiene estilo. */
function letraDelTitulo(estado: EstadoFotolibro, medidasPliego: Medidas): Pick<TextoDelEstilo, "fuente" | "color" | "negrita" | "italica" | "mayusculas"> & { texto: string } {
  const estilo = estiloPorId(estado.estilo?.id);
  const titulo = estilo?.textos?.("apertura", medidasPliego).find((t) => t.rol === "titulo");
  const sub = estilo?.textos?.("apertura", medidasPliego).find((t) => t.rol !== "titulo");
  return {
    fuente: titulo?.fuente ?? "Playfair Display",
    color: titulo?.color ?? "#2b2b2b",
    negrita: titulo?.negrita,
    italica: titulo?.italica,
    mayusculas: titulo?.mayusculas,
    texto: sub?.fuente ?? titulo?.fuente ?? "Playfair Display",
  };
}

function bloqueTexto(id: string, contenido: string, caja: Rect, puntos: number, letra: { fuente: string; color: string; negrita?: boolean; italica?: boolean; mayusculas?: boolean }, dpi: number): TemplateV2Block {
  // Igual que en los pliegos: si lo escrito no entra, se achica (media letra de ancho por cuerpo).
  const cuerpoMm = (puntos * 25.4) / 72;
  const ancho = contenido.length * cuerpoMm * (letra.mayusculas ? 0.72 : 0.5);
  const escala = ancho > caja.w ? Math.max(0.35, caja.w / ancho) : 1;
  return {
    id,
    type: "TEXT",
    pageIndex: 0,
    name: id,
    layout: { x: px(caja.x, dpi), y: px(caja.y, dpi), width: px(caja.w, dpi), height: px(caja.h, dpi), rotation: 0, zIndex: 40, opacity: 1, locked: false, visible: true },
    configJson: {
      content: contenido,
      fontFamily: letra.fuente,
      fontSize: (puntos * escala * dpi) / 72,
      fontWeight: letra.negrita ? 700 : 400,
      fontItalic: letra.italica === true,
      color: letra.color,
      textAlign: "center",
      ...(letra.mayusculas ? { textTransform: "uppercase", letterSpacing: 2 } : {}),
      lineHeight: 1.15,
    },
  };
}

/**
 * Los bloques de la tapa: papel, fotos (tapa y, si la hay, contratapa) y el título del libro sobre
 * una franja, en la cara de la tapa. En la contratapa sin foto va la frase del cierre.
 */
export function bloquesDeTapa(estado: EstadoFotolibro, hojas: number, medidasPliego: Medidas): TemplateV2Block[] {
  const armado = tapaDelLibro(estado, hojas);
  if (!armado || !estado.tapa) return [];
  const { modelo, geometria: g, lienzo } = armado;
  const dpi = lienzo.dpi;
  const estilo = estiloPorId(estado.estilo?.id);
  const papel = estilo?.papel ?? "#ffffff";
  const fotos = new Map(estado.fotos.map((f) => [f.id, f]));
  const marcos = marcosDeTapa(modelo, g);
  const out: TemplateV2Block[] = [
    {
      id: "tapa-fondo",
      type: "BACKGROUND",
      pageIndex: 0,
      name: "Fondo",
      layout: { x: 0, y: 0, width: lienzo.width, height: lienzo.height, rotation: 0, zIndex: 0, opacity: 1, locked: true, visible: true },
      configJson: { backgroundColor: papel },
    },
  ];

  const fotoTapa = estado.tapa.fotoId ? fotos.get(estado.tapa.fotoId) : undefined;
  if (fotoTapa) out.push(bloqueFoto(ID_FOTO_TAPA, fotoTapa, marcos.tapa, estado.tapa.encuadre, dpi));
  const fotoContra = estado.tapa.contratapaFotoId ? fotos.get(estado.tapa.contratapaFotoId) : undefined;
  if (fotoContra && marcos.contratapa) {
    out.push(bloqueFoto(ID_FOTO_CONTRATAPA, fotoContra, marcos.contratapa, estado.tapa.contratapaEncuadre, dpi));
  }

  const textos = estado.estilo?.textos ?? {};
  const titulo = textos.titulo?.trim();
  const debajo = (textos.subtitulo || textos.fecha)?.trim();
  const letra = letraDelTitulo(estado, medidasPliego);
  const cara = g.tapa;
  if (titulo) {
    const margen = cara.w * 0.08;
    const alto = cara.h * (debajo ? 0.2 : 0.15);
    const franja = { x: cara.x, y: cara.y + cara.h * 0.66, w: cara.w, h: alto };
    // Sobre una foto el título necesita fondo para leerse; sobre el papel, no.
    if (fotoTapa) {
      out.push({
        id: "tapa-franja",
        type: "SHAPE",
        pageIndex: 0,
        name: "Franja del título",
        layout: { x: px(franja.x, dpi), y: px(franja.y, dpi), width: px(franja.w, dpi), height: px(franja.h, dpi), rotation: 0, zIndex: 30, opacity: 0.85, locked: false, visible: true },
        configJson: { variant: "rectangle", fill: papel, strokeWidth: 0 },
      });
    }
    const puntos = (cara.h * 0.07 * 72) / 25.4;
    const altoTitulo = debajo ? franja.h * 0.6 : franja.h;
    out.push(bloqueTexto("tapa-titulo", titulo, { x: franja.x + margen, y: franja.y + (debajo ? franja.h * 0.08 : 0), w: franja.w - 2 * margen, h: altoTitulo }, puntos, letra, dpi));
    if (debajo) {
      out.push(
        bloqueTexto("tapa-subtitulo", debajo, { x: franja.x + margen, y: franja.y + franja.h * 0.64, w: franja.w - 2 * margen, h: franja.h * 0.3 }, puntos * 0.38, { ...letra, fuente: letra.texto, mayusculas: true, negrita: false, italica: false }, dpi),
      );
    }
  }

  const frase = textos.frase?.trim();
  if (frase && g.contratapa && !fotoContra) {
    const c = g.contratapa;
    out.push(bloqueTexto("contratapa-frase", frase, { x: c.x + c.w * 0.12, y: c.y + c.h * 0.4, w: c.w * 0.76, h: c.h * 0.2 }, (c.h * 0.035 * 72) / 25.4, { ...letra, mayusculas: false }, dpi));
  }
  return out;
}
