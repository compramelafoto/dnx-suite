import type { DesignBlock, DesignDocument, VariableContract } from "@repo/design-studio";
import { CLF_LOGO_ASPECT, CLF_LOGO_COLOR_PNG_BASE64, CLF_LOGO_WHITE_PNG_BASE64 } from "./clf-logo-data";

/**
 * Plantillas de collage para la historia diaria de un álbum (1080×1920, 9:16).
 *
 * Estilo (pedido 2026-11-21): sobrio y minimalista. Fondos blanco, negro o hueso, sin
 * adornos, fotos grandes y el logo de CompraMeLaFoto. Veinte modelos que salen de
 * combinar distribuciones de fotos (`LAYOUTS`), una paleta (`TEMAS`) y la forma de ubicar
 * el texto (`pie` o `cabecera`). Se rotan por orden de salida, así dos historias seguidas
 * nunca repiten diseño.
 *
 * El «Comprar aquí» es un botón DIBUJADO: Meta no deja poner el sticker de enlace por
 * API, así que no se puede tocar. Debajo va la dirección del álbum en letra legible. Al
 * fotógrafo (y a quien él sume) se lo etiqueta con `user_tags`.
 *
 * Zona segura: Instagram tapa ~250 px arriba y ~250 px abajo. Las fotos pueden pasar por
 * debajo de esas franjas; el texto, el logo y el botón no.
 *
 * Ningún contrato lee campos de documento de identidad: son piezas públicas.
 */

export const STORY_W = 1080;
export const STORY_H = 1920;
export const SEGURA_ARRIBA = 250;
export const SEGURA_ABAJO = STORY_H - 250;

/** Referencias de recurso del logo; las resuelve `readStoryBrandResource`. */
export const LOGO_COLOR_REF = "clf:logo-color";
export const LOGO_BLANCO_REF = "clf:logo-blanco";

export function readStoryBrandResource(ref: string): Uint8Array | null {
  if (ref === LOGO_COLOR_REF) return new Uint8Array(Buffer.from(CLF_LOGO_COLOR_PNG_BASE64, "base64"));
  if (ref === LOGO_BLANCO_REF) return new Uint8Array(Buffer.from(CLF_LOGO_WHITE_PNG_BASE64, "base64"));
  return null;
}

export type StoryCollage = {
  id: string;
  nombre: string;
  /** Cantidad de fotos que dibuja: 3 o 4. */
  fotos: 3 | 4;
  document: DesignDocument;
  contract: VariableContract;
};

// ---------------------------------------------------------------------------
// Paletas
// ---------------------------------------------------------------------------

type Tema = {
  id: "blanco" | "negro" | "hueso";
  fondo: string;
  texto: string;
  suave: string;
  boton: string;
  textoBoton: string;
  logo: string;
};

const TEMAS: Record<Tema["id"], Tema> = {
  blanco: {
    id: "blanco",
    fondo: "#ffffff",
    texto: "#111111",
    suave: "#6b6b6b",
    boton: "#111111",
    textoBoton: "#ffffff",
    logo: LOGO_COLOR_REF,
  },
  negro: {
    id: "negro",
    fondo: "#0f0f0f",
    texto: "#ffffff",
    suave: "#a3a3a3",
    boton: "#ffffff",
    textoBoton: "#111111",
    logo: LOGO_BLANCO_REF,
  },
  hueso: {
    id: "hueso",
    fondo: "#f3efe8",
    texto: "#1c1a17",
    suave: "#7a736a",
    boton: "#c27b3d",
    textoBoton: "#ffffff",
    logo: LOGO_COLOR_REF,
  },
};

// ---------------------------------------------------------------------------
// Distribuciones de fotos: reparten una zona (x, y, w, h) con un espacio `g` entre fotos
// ---------------------------------------------------------------------------

type Caja = { x: number; y: number; w: number; h: number };
type Layout = { id: string; nombre: string; fotos: 3 | 4; cajas: (z: Caja, g: number) => Caja[] };

const filas = (z: Caja, g: number, n: number, pesos?: number[]): Caja[] => {
  const p = pesos ?? Array(n).fill(1);
  const total = p.reduce((a, b) => a + b, 0);
  const libre = z.h - g * (n - 1);
  let y = z.y;
  return p.map((peso, i) => {
    // La última ocupa lo que sobra: así el redondeo nunca la saca de la zona.
    const h = i === n - 1 ? z.y + z.h - y : Math.round((libre * peso) / total);
    const c = { x: z.x, y, w: z.w, h };
    y += h + g;
    return c;
  });
};

const columnas = (z: Caja, g: number, n: number, pesos?: number[]): Caja[] => {
  const p = pesos ?? Array(n).fill(1);
  const total = p.reduce((a, b) => a + b, 0);
  const libre = z.w - g * (n - 1);
  let x = z.x;
  return p.map((peso, i) => {
    const w = i === n - 1 ? z.x + z.w - x : Math.round((libre * peso) / total);
    const c = { x, y: z.y, w, h: z.h };
    x += w + g;
    return c;
  });
};

const LAYOUTS: Layout[] = [
  {
    id: "grilla",
    nombre: "Grilla 2×2",
    fotos: 4,
    cajas: (z, g) => filas(z, g, 2).flatMap((f) => columnas(f, g, 2)),
  },
  {
    id: "grande-arriba-2",
    nombre: "Una grande y dos abajo",
    fotos: 3,
    cajas: (z, g) => {
      const [a, b] = filas(z, g, 2, [1.6, 1]);
      return [a!, ...columnas(b!, g, 2)];
    },
  },
  {
    id: "grande-arriba-3",
    nombre: "Una grande y tres abajo",
    fotos: 4,
    cajas: (z, g) => {
      const [a, b] = filas(z, g, 2, [2, 1]);
      return [a!, ...columnas(b!, g, 3)];
    },
  },
  {
    id: "grande-izquierda-2",
    nombre: "Vertical y dos al costado",
    fotos: 3,
    cajas: (z, g) => {
      const [a, b] = columnas(z, g, 2, [1.5, 1]);
      return [a!, ...filas(b!, g, 2)];
    },
  },
  {
    id: "grande-derecha-3",
    nombre: "Vertical a la derecha y tres al costado",
    fotos: 4,
    cajas: (z, g) => {
      const [a, b] = columnas(z, g, 2, [1, 1.7]);
      return [b!, ...filas(a!, g, 3)];
    },
  },
  {
    id: "tres-columnas",
    nombre: "Tres verticales",
    fotos: 3,
    cajas: (z, g) => columnas(z, g, 3),
  },
  {
    id: "tres-filas",
    nombre: "Tres franjas",
    fotos: 3,
    cajas: (z, g) => filas(z, g, 3),
  },
  {
    id: "dos-arriba-una-abajo",
    nombre: "Dos arriba y una ancha",
    fotos: 3,
    cajas: (z, g) => {
      const [a, b] = filas(z, g, 2, [1, 1.1]);
      return [b!, ...columnas(a!, g, 2)];
    },
  },
  {
    id: "cuatro-filas",
    nombre: "Cuatro franjas",
    fotos: 4,
    cajas: (z, g) => filas(z, g, 4),
  },
  {
    id: "ancha-y-tres",
    nombre: "Ancha arriba, tres abajo iguales",
    fotos: 4,
    cajas: (z, g) => {
      const [a, b] = filas(z, g, 2, [1, 1.2]);
      return [a!, ...columnas(b!, g, 3)];
    },
  },
  {
    id: "espejo",
    nombre: "Dos a la izquierda y vertical a la derecha",
    fotos: 3,
    cajas: (z, g) => {
      const [izq, der] = columnas(z, g, 2, [1.35, 1]);
      const [arriba, abajo] = filas(izq!, g, 2, [1.3, 1]);
      return [der!, arriba!, abajo!];
    },
  },
  {
    id: "vertical-central",
    nombre: "Vertical al centro",
    fotos: 3,
    cajas: (z, g) => columnas(z, g, 3, [1, 2.2, 1]).map((c, i) => (i === 1 ? c : { ...c, y: c.y + Math.round(c.h * 0.18), h: Math.round(c.h * 0.64) })),
  },
];

// ---------------------------------------------------------------------------
// Texto: logo, título, crédito, botón «Comprar aquí» y la dirección
// ---------------------------------------------------------------------------

function texto(
  id: string,
  content: string,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { size: number; color: string; bold?: boolean; align: "left" | "center"; lines?: number; valign?: "top" | "middle"; font?: string; upper?: boolean },
): DesignBlock {
  return {
    id,
    type: "text",
    x,
    y,
    width: w,
    height: h,
    fontId: o.font ?? "dmSans",
    fontSize: o.size,
    fontWeight: o.bold ? "bold" : "normal",
    color: o.color,
    align: o.align,
    verticalAlign: o.valign ?? "top",
    ...(o.upper ? { textTransform: "uppercase" } : {}),
    content,
    maxLines: o.lines ?? 1,
    lineHeight: 1.12,
  } as DesignBlock;
}

const LOGO_H = 64;
const LOGO_W = Math.round(LOGO_H * CLF_LOGO_ASPECT);
const BOTON_W = 440;
const BOTON_H = 92;

function logo(t: Tema, x: number, y: number): DesignBlock {
  return { id: "logo", type: "image", x, y, width: LOGO_W, height: LOGO_H, resourceRef: t.logo, fit: "contain" } as DesignBlock;
}

function boton(t: Tema, x: number, y: number): DesignBlock[] {
  return [
    { id: "boton", type: "rect", x, y, width: BOTON_W, height: BOTON_H, fillColor: t.boton, cornerRadius: BOTON_H / 2 } as DesignBlock,
    texto("botonTexto", "Comprar aquí", x, y, BOTON_W, BOTON_H, {
      size: 24,
      color: t.textoBoton,
      bold: true,
      align: "center",
      valign: "middle",
    }),
  ];
}

/**
 * Bloque de texto abajo (y = 1274…1636): logo, la frase grande que va cambiando, el
 * nombre del álbum, el crédito, el botón y la dirección.
 */
function textoAbajo(t: Tema, align: "left" | "center", margen: number): DesignBlock[] {
  const x = margen;
  const w = STORY_W - margen * 2;
  const xc = (ancho: number) => (align === "center" ? Math.round((STORY_W - ancho) / 2) : x);
  return [
    logo(t, xc(LOGO_W), 1274),
    texto("frase", "{{frase}}", x, 1344, w, 48, { size: 29, color: t.texto, bold: true, align }),
    texto("titulo", "{{nombreAlbum}}", x, 1396, w, 66, { size: 19, color: t.texto, align, lines: 2 }),
    texto("credito", "{{creditoFotografo}}", x, 1466, w, 30, { size: 16, color: t.suave, align }),
    ...boton(t, xc(BOTON_W), 1502),
    texto("url", "{{urlAlbum}}", x, 1602, w, 34, { size: 19, color: t.texto, bold: true, align }),
  ];
}

/** Logo, frase y nombre arriba (250…436); crédito, botón y dirección abajo (1464…1640). */
function textoArribaYAbajo(t: Tema, margen: number): DesignBlock[] {
  const w = STORY_W - margen * 2;
  return [
    logo(t, Math.round((STORY_W - LOGO_W) / 2), SEGURA_ARRIBA),
    texto("frase", "{{frase}}", margen, 320, w, 48, { size: 29, color: t.texto, bold: true, align: "center" }),
    texto("titulo", "{{nombreAlbum}}", margen, 370, w, 66, { size: 19, color: t.texto, align: "center", lines: 2 }),
    texto("credito", "{{creditoFotografo}}", margen, 1464, w, 30, { size: 16, color: t.suave, align: "center" }),
    ...boton(t, Math.round((STORY_W - BOTON_W) / 2), 1500),
    texto("url", "{{urlAlbum}}", margen, 1604, w, 34, { size: 19, color: t.texto, bold: true, align: "center" }),
  ];
}

// ---------------------------------------------------------------------------
// Armado de los 20 modelos
// ---------------------------------------------------------------------------

/**
 * - `sangre`: fotos de borde a borde desde arriba (pasan por debajo de la barra de
 *   Instagram), separadas por una línea fina. Texto abajo.
 * - `marco`: margen parejo alrededor, como un paspartú. Texto abajo.
 * - `centro`: logo y título arriba, fotos al medio, botón abajo.
 */
type Composicion = "sangre" | "marco" | "centro";

function zona(c: Composicion): { caja: Caja; g: number } {
  if (c === "sangre") return { caja: { x: 0, y: 0, w: STORY_W, h: 1262 }, g: 8 };
  if (c === "marco") return { caja: { x: 56, y: 120, w: STORY_W - 112, h: 1130 }, g: 14 };
  return { caja: { x: 0, y: 446, w: STORY_W, h: 996 }, g: 8 };
}

function armar(layoutId: string, temaId: Tema["id"], comp: Composicion, align: "left" | "center" = "center"): StoryCollage {
  const layout = LAYOUTS.find((l) => l.id === layoutId);
  if (!layout) throw new Error(`Distribución desconocida: ${layoutId}`);
  const t = TEMAS[temaId];
  const { caja, g } = zona(comp);
  const fotos = layout.cajas(caja, g).map(
    (c, i) =>
      ({
        id: `f${i + 1}`,
        type: "image",
        x: c.x,
        y: c.y,
        width: c.w,
        height: c.h,
        variableKey: `foto${i + 1}`,
        fit: "cover",
      }) as DesignBlock,
  );
  const textos = comp === "centro" ? textoArribaYAbajo(t, 72) : textoAbajo(t, align, comp === "marco" ? 56 : 72);
  const id = `clf-story-${layout.id}-${t.id}-${comp}${align === "left" ? "-izq" : ""}`;
  return {
    id,
    nombre: `${layout.nombre} · ${t.id} · ${comp}`,
    fotos: layout.fotos,
    contract: contrato(layout.fotos),
    document: {
      schemaVersion: 1,
      metadata: { name: id, description: "Historia diaria de álbum (CompraMeLaFoto), estilo sobrio." },
      format: { medium: "SCREEN", width: STORY_W, height: STORY_H },
      sides: [{ id: "historia", name: "Historia", background: t.fondo, blocks: [...fotos, ...textos] }],
    },
  };
}

function contrato(fotos: number): VariableContract {
  return {
    variables: [
      { key: "frase", type: "text", label: "Frase grande", required: true, sampleValue: "¡Ya están disponibles!", maxLength: 40 },
      { key: "nombreAlbum", type: "text", label: "Nombre del álbum", required: true, sampleValue: "Maratón de Santa Fe 2026", maxLength: 80 },
      { key: "creditoFotografo", type: "text", label: "Crédito del fotógrafo", required: false, sampleValue: "Fotos de @fotografo", maxLength: 45 },
      { key: "urlAlbum", type: "text", label: "Dirección del álbum", required: true, sampleValue: "compramelafoto.com/a/1557", maxLength: 70 },
      ...Array.from({ length: fotos }, (_, i) => ({
        key: `foto${i + 1}`,
        type: "image" as const,
        label: `Foto ${i + 1}`,
        required: true,
        sampleValue: `https://cdn/${i + 1}.jpg`,
      })),
    ],
  };
}

/**
 * Orden pensado para que dos seguidas cambien siempre de fondo y de distribución.
 */
export const STORY_COLLAGES: readonly StoryCollage[] = [
  armar("grilla", "blanco", "sangre"),
  armar("grande-izquierda-2", "negro", "marco"),
  armar("tres-columnas", "hueso", "centro"),
  armar("grande-arriba-3", "blanco", "marco", "left"),
  armar("cuatro-filas", "negro", "sangre"),
  armar("dos-arriba-una-abajo", "hueso", "marco"),
  armar("vertical-central", "blanco", "centro"),
  armar("grande-derecha-3", "negro", "sangre", "left"),
  armar("grande-arriba-2", "hueso", "sangre"),
  armar("espejo", "blanco", "marco"),
  armar("tres-filas", "negro", "centro"),
  armar("ancha-y-tres", "hueso", "marco", "left"),
  armar("grande-izquierda-2", "blanco", "sangre", "left"),
  armar("grilla", "negro", "marco"),
  armar("grande-arriba-3", "hueso", "centro"),
  armar("tres-columnas", "blanco", "marco"),
  armar("espejo", "negro", "sangre"),
  armar("cuatro-filas", "hueso", "centro"),
  armar("dos-arriba-una-abajo", "blanco", "sangre", "left"),
  armar("vertical-central", "negro", "marco"),
];

/** Máximo de fotos que puede pedir cualquier plantilla: es cuántas hay que elegir. */
export const STORY_COLLAGE_MAX_PHOTOS = 4;

/**
 * Elige la plantilla por orden de salida, así dos historias seguidas no se repiten.
 * `ordinal` es cualquier entero que crezca de a uno (la cantidad de historias ya armadas).
 */
export function pickStoryCollage(ordinal: number): StoryCollage {
  const n = STORY_COLLAGES.length;
  const i = ((Math.trunc(ordinal) % n) + n) % n;
  return STORY_COLLAGES[i]!;
}
