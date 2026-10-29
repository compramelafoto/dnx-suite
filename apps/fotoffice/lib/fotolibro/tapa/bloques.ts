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

/** Los diseños de portada genéricos: sirven para cualquier modelo de tapa. */
export const DISENOS_TAPA = [
  { id: "franja", nombre: "Foto con franja", detalle: "Foto a sangre y el título sobre una franja abajo." },
  { id: "titulo-arriba", nombre: "Título arriba", detalle: "Foto a sangre y el título en una franja arriba." },
  { id: "ventana", nombre: "Ventana", detalle: "La foto en un recuadro sobre el papel y el título debajo." },
  { id: "mitad", nombre: "Media foto", detalle: "La foto ocupa la parte de arriba; el título va en el papel." },
  { id: "tipografica", nombre: "Sólo título", detalle: "Sin foto: el título grande, centrado, con filetes." },
  { id: "sin-texto", nombre: "Sólo foto", detalle: "La foto a sangre, sin textos." },
] as const;

export type DisenoTapa = (typeof DISENOS_TAPA)[number]["id"];

export const disenoDeTapa = (id: string | null | undefined): DisenoTapa =>
  (DISENOS_TAPA.find((d) => d.id === id)?.id ?? "franja") as DisenoTapa;

function rect(id: string, r: Rect, dpi: number, fill: string, opacity = 1, z = 30): TemplateV2Block {
  return {
    id,
    type: "SHAPE",
    pageIndex: 0,
    name: id,
    layout: { x: px(r.x, dpi), y: px(r.y, dpi), width: px(r.w, dpi), height: px(r.h, dpi), rotation: 0, zIndex: z, opacity, locked: false, visible: true },
    configJson: { variant: "rectangle", fill, strokeWidth: 0 },
  };
}

/**
 * Los bloques de la tapa: papel, fotos (tapa y, si la hay, contratapa), el título según el diseño
 * elegido y, si el lomo da, el título en el lomo. En la contratapa sin foto va la frase del cierre.
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
  const diseno = disenoDeTapa(estado.tapa.diseno);
  const cara = g.tapa;
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

  // Dónde va la foto de tapa según el diseño. Las que van a sangre siguen por la demasía.
  const marcoFoto: Rect | null =
    diseno === "tipografica"
      ? null
      : diseno === "ventana"
        ? { x: cara.x + cara.w * 0.14, y: cara.y + cara.h * 0.12, w: cara.w * 0.72, h: cara.h * 0.56 }
        : diseno === "mitad"
          ? { x: marcos.tapa.x, y: 0, w: marcos.tapa.w, h: cara.y + cara.h * 0.62 }
          : marcos.tapa;
  const fotoTapa = estado.tapa.fotoId ? fotos.get(estado.tapa.fotoId) : undefined;
  if (fotoTapa && marcoFoto) out.push(bloqueFoto(ID_FOTO_TAPA, fotoTapa, marcoFoto, estado.tapa.encuadre, dpi));
  const fotoContra = estado.tapa.contratapaFotoId ? fotos.get(estado.tapa.contratapaFotoId) : undefined;
  if (fotoContra && marcos.contratapa) {
    out.push(bloqueFoto(ID_FOTO_CONTRATAPA, fotoContra, marcos.contratapa, estado.tapa.contratapaEncuadre, dpi));
  }

  // Los textos de la tapa: los propios, o si no, los del estilo.
  const textos = { ...(estado.estilo?.textos ?? {}), ...(estado.tapa.textos ?? {}) };
  const titulo = textos.titulo?.trim();
  const debajo = (textos.subtitulo || textos.fecha)?.trim();
  const letra = letraDelTitulo(estado, medidasPliego);
  const letraChica = { ...letra, fuente: letra.texto, mayusculas: true, negrita: false, italica: false };
  const margen = cara.w * 0.08;
  const puntos = (cara.h * 0.07 * 72) / 25.4;

  /** Título (y lo de debajo) centrados en una caja de la cara. */
  const titular = (caja: Rect, escala = 1) => {
    if (!titulo) return;
    const altoTitulo = debajo ? caja.h * 0.6 : caja.h;
    out.push(bloqueTexto("tapa-titulo", titulo, { x: caja.x + margen, y: caja.y + (debajo ? caja.h * 0.08 : 0), w: caja.w - 2 * margen, h: altoTitulo }, puntos * escala, letra, dpi));
    if (debajo) {
      out.push(bloqueTexto("tapa-subtitulo", debajo, { x: caja.x + margen, y: caja.y + caja.h * 0.64, w: caja.w - 2 * margen, h: caja.h * 0.3 }, puntos * escala * 0.38, letraChica, dpi));
    }
  };

  if (titulo && diseno !== "sin-texto") {
    const alto = cara.h * (debajo ? 0.2 : 0.15);
    if (diseno === "franja" || diseno === "titulo-arriba") {
      const franja = { x: cara.x, y: diseno === "franja" ? cara.y + cara.h * 0.66 : cara.y + cara.h * 0.08, w: cara.w, h: alto };
      // Sobre una foto el título necesita fondo para leerse; sobre el papel, no.
      if (fotoTapa) out.push(rect("tapa-franja", franja, dpi, papel, 0.85));
      titular(franja);
    } else if (diseno === "ventana") {
      titular({ x: cara.x, y: cara.y + cara.h * 0.72, w: cara.w, h: alto });
    } else if (diseno === "mitad") {
      titular({ x: cara.x, y: cara.y + cara.h * 0.7, w: cara.w, h: alto });
    } else {
      // Tipográfica: título grande en el centro, entre dos filetes finos del color de la letra.
      const caja = { x: cara.x, y: cara.y + cara.h * 0.36, w: cara.w, h: cara.h * 0.28 };
      const filete = Math.max(0.4, cara.h * 0.0015);
      out.push(rect("tapa-filete-1", { x: cara.x + cara.w * 0.3, y: caja.y - cara.h * 0.03, w: cara.w * 0.4, h: filete }, dpi, letra.color));
      out.push(rect("tapa-filete-2", { x: cara.x + cara.w * 0.3, y: caja.y + caja.h + cara.h * 0.03, w: cara.w * 0.4, h: filete }, dpi, letra.color));
      titular(caja, 1.35);
    }
  }

  // El lomo: el título a lo largo, si entra una letra legible (8 mm o más).
  if (titulo && g.lomo && g.lomo.w >= 8) {
    const l = g.lomo;
    const largo = l.h * 0.8;
    const grosor = l.w * 0.8;
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    const b = bloqueTexto("lomo-titulo", titulo, { x: cx - largo / 2, y: cy - grosor / 2, w: largo, h: grosor }, (grosor * 0.55 * 72) / 25.4, letra, dpi);
    // Se lee de arriba hacia abajo, como los lomos de los libros en castellano e inglés.
    out.push({ ...b, layout: { ...b.layout, rotation: 90 } });
  }

  const frase = textos.frase?.trim();
  if (frase && g.contratapa && !fotoContra) {
    const c = g.contratapa;
    out.push(bloqueTexto("contratapa-frase", frase, { x: c.x + c.w * 0.12, y: c.y + c.h * 0.4, w: c.w * 0.76, h: c.h * 0.2 }, (c.h * 0.035 * 72) / 25.4, { ...letra, mayusculas: false }, dpi));
  }
  return out;
}
