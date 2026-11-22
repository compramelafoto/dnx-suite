import type { DesignBlock, DesignDocument, VariableContract } from "@repo/design-studio";

/**
 * Plantillas de collage para la historia diaria de un álbum (1080×1920, 9:16).
 *
 * Por qué varias: si todas las historias del día salen con el mismo armado, quien mira
 * pasa de largo a partir de la segunda. Se rotan por orden de salida (`pickStoryCollage`),
 * así dos historias seguidas nunca repiten diseño.
 *
 * Todo lo que tiene que leerse va impreso en la imagen: Meta no deja poner el sticker de
 * enlace por API. La dirección del álbum se escribe corta y en grande para que se pueda
 * copiar a mano. Al fotógrafo, además del texto impreso, se lo etiqueta con `user_tags`
 * (ver `instagram-publish.ts`): le llega la notificación y puede compartirla.
 *
 * Las fotos llegan siempre con marca de agua (las mismas derivadas que la galería).
 * Ningún contrato lee campos de documento de identidad: son piezas públicas.
 */

export const STORY_W = 1080;
export const STORY_H = 1920;

const MARCA = "#c27b3d";
const OSCURO = "#111827";
const CREMA = "#f6f1ea";
const BLANCO = "#ffffff";

export type StoryCollage = {
  id: string;
  nombre: string;
  /** Cantidad de fotos que dibuja: 3 o 4. */
  fotos: 3 | 4;
  document: DesignDocument;
  contract: VariableContract;
};

function contrato(fotos: number): VariableContract {
  return {
    variables: [
      {
        key: "nombreAlbum",
        type: "text",
        label: "Nombre del álbum",
        required: true,
        sampleValue: "Maratón de Santa Fe 2026",
        maxLength: 60,
      },
      {
        key: "creditoFotografo",
        type: "text",
        label: "Crédito del fotógrafo",
        required: false,
        sampleValue: "Fotos de @fotografo",
        maxLength: 45,
      },
      {
        key: "urlAlbum",
        type: "text",
        label: "Dirección del álbum",
        required: true,
        sampleValue: "compramelafoto.com/a/maraton",
        maxLength: 70,
      },
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

function foto(id: string, n: number, x: number, y: number, w: number, h: number, extra: Partial<DesignBlock> = {}): DesignBlock {
  return { id, type: "image", x, y, width: w, height: h, variableKey: `foto${n}`, fit: "cover", ...extra } as DesignBlock;
}

function rect(id: string, x: number, y: number, w: number, h: number, fillColor: string, extra: Record<string, unknown> = {}): DesignBlock {
  return { id, type: "rect", x, y, width: w, height: h, fillColor, ...extra } as DesignBlock;
}

function texto(
  id: string,
  content: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    size: number;
    color: string;
    font?: string;
    bold?: boolean;
    align?: "left" | "center" | "right";
    lines?: number;
    upper?: boolean;
    valign?: "top" | "middle" | "bottom";
  },
): DesignBlock {
  return {
    id,
    type: "text",
    x,
    y,
    width: w,
    height: h,
    fontId: opts.font ?? "dmSans",
    fontSize: opts.size,
    fontWeight: opts.bold ? "bold" : "normal",
    color: opts.color,
    align: opts.align ?? "left",
    verticalAlign: opts.valign ?? "top",
    ...(opts.upper ? { textTransform: "uppercase" } : {}),
    content,
    maxLines: opts.lines ?? 1,
    lineHeight: 1.1,
  } as DesignBlock;
}

/**
 * Zona segura de una historia: Instagram tapa ~250 px arriba (cuenta y barra de progreso) y
 * ~250 px abajo (barra para responder). Todo texto va entre `SEGURA_ARRIBA` y `SEGURA_ABAJO`;
 * las fotos pueden pasar por debajo de esas franjas, el texto no.
 */
export const SEGURA_ARRIBA = 250;
export const SEGURA_ABAJO = STORY_H - 250;

/** Alto del pie: crédito + «Buscá tus fotos en» + píldora con la dirección. */
const PIE_Y = 1430;

/** Pie común: crédito, «Buscá tus fotos en» y la dirección en una píldora. */
function pie(colorTexto: string, align: "left" | "center" = "center", colorPildora = MARCA): DesignBlock[] {
  const x = 72;
  const w = STORY_W - 144;
  const y = PIE_Y;
  return [
    texto("credito", "{{creditoFotografo}}", x, y, w, 50, { size: 26, color: colorTexto, align, bold: true }),
    texto("busca", "Buscá tus fotos en", x, y + 58, w, 40, { size: 22, color: colorTexto, align }),
    rect("pildora", x, y + 112, w, 108, colorPildora, { cornerRadius: 54 }),
    texto("url", "{{urlAlbum}}", x + 24, y + 112, w - 48, 108, {
      size: 26,
      color: BLANCO,
      bold: true,
      align: "center",
      valign: "middle",
    }),
  ];
}

function documento(nombre: string, background: string, blocks: DesignBlock[]): DesignDocument {
  return {
    schemaVersion: 1,
    metadata: { name: nombre, description: "Collage de historia diaria de álbum (CompraMeLaFoto)." },
    format: { medium: "SCREEN", width: STORY_W, height: STORY_H },
    sides: [{ id: "historia", name: "Historia", background, blocks }],
  };
}

/** 1. Grilla 2×2 sobre fondo oscuro, título arriba. */
const GRILLA: StoryCollage = {
  id: "clf-story-grilla-4",
  nombre: "Grilla",
  fotos: 4,
  contract: contrato(4),
  document: documento("Grilla", OSCURO, [
    texto("marca", "COMPRAMELAFOTO", 72, SEGURA_ARRIBA, 936, 36, { size: 16, color: MARCA, bold: true, align: "center" }),
    texto("titulo", "{{nombreAlbum}}", 72, 290, 936, 150, {
      size: 38,
      color: BLANCO,
      bold: true,
      align: "center",
      lines: 2,
      valign: "middle",
    }),
    foto("f1", 1, 48, 460, 483, 460, { cornerRadius: 28 }),
    foto("f2", 2, 549, 460, 483, 460, { cornerRadius: 28 }),
    foto("f3", 3, 48, 938, 483, 460, { cornerRadius: 28 }),
    foto("f4", 4, 549, 938, 483, 460, { cornerRadius: 28 }),
    ...pie(BLANCO),
  ]),
};

/** 2. Una foto grande arriba (pasa por debajo de la barra de Instagram) y dos abajo. */
const PROTAGONISTA: StoryCollage = {
  id: "clf-story-protagonista-3",
  nombre: "Protagonista",
  fotos: 3,
  contract: contrato(3),
  document: documento("Protagonista", CREMA, [
    foto("f1", 1, 0, 0, STORY_W, 900),
    rect("franja", 0, 880, STORY_W, 20, MARCA),
    texto("titulo", "{{nombreAlbum}}", 72, 925, 936, 130, {
      size: 34,
      color: OSCURO,
      bold: true,
      font: "playfairDisplay",
      lines: 2,
      valign: "middle",
    }),
    foto("f2", 2, 72, 1075, 459, 325, { cornerRadius: 20 }),
    foto("f3", 3, 549, 1075, 459, 325, { cornerRadius: 20 }),
    ...pie(OSCURO, "left"),
  ]),
};

/** 3. Tres fotos tipo instantánea, giradas, sobre fondo de marca. */
const INSTANTANEAS: StoryCollage = {
  id: "clf-story-instantaneas-3",
  nombre: "Instantáneas",
  fotos: 3,
  contract: contrato(3),
  document: documento("Instantáneas", MARCA, [
    texto("titulo", "{{nombreAlbum}}", 72, SEGURA_ARRIBA, 936, 150, {
      size: 38,
      color: BLANCO,
      bold: true,
      align: "center",
      lines: 2,
      valign: "middle",
    }),
    rect("marco1", 90, 440, 500, 560, BLANCO, { rotation: -6 }),
    foto("f1", 1, 115, 465, 450, 450, { rotation: -6 }),
    rect("marco2", 490, 560, 500, 560, BLANCO, { rotation: 5 }),
    foto("f2", 2, 515, 585, 450, 450, { rotation: 5 }),
    rect("marco3", 200, 820, 500, 560, BLANCO, { rotation: -2 }),
    foto("f3", 3, 225, 845, 450, 450, { rotation: -2 }),
    ...pie(BLANCO, "center", OSCURO),
  ]),
};

/** 4. Tira de cuatro franjas horizontales, como una película. */
const TIRA: StoryCollage = {
  id: "clf-story-tira-4",
  nombre: "Tira",
  fotos: 4,
  contract: contrato(4),
  document: documento("Tira", "#000000", [
    foto("f1", 1, 0, 0, STORY_W, 300),
    foto("f2", 2, 0, 310, STORY_W, 300),
    foto("f3", 3, 0, 620, STORY_W, 300),
    foto("f4", 4, 0, 930, STORY_W, 300),
    rect("banda", 0, 1230, STORY_W, 690, OSCURO),
    rect("acento", 72, 1262, 120, 10, MARCA),
    texto("titulo", "{{nombreAlbum}}", 72, 1288, 936, 130, {
      size: 36,
      color: BLANCO,
      bold: true,
      font: "barlowCondensed",
      upper: true,
      lines: 2,
      valign: "middle",
    }),
    ...pie(BLANCO, "left"),
  ]),
};

/** 5. Mosaico: una vertical grande a la izquierda y tres apiladas a la derecha. */
const MOSAICO: StoryCollage = {
  id: "clf-story-mosaico-4",
  nombre: "Mosaico",
  fotos: 4,
  contract: contrato(4),
  document: documento("Mosaico", BLANCO, [
    texto("marca", "COMPRAMELAFOTO", 48, SEGURA_ARRIBA, 984, 36, { size: 16, color: MARCA, bold: true }),
    texto("titulo", "{{nombreAlbum}}", 48, 290, 984, 150, {
      size: 36,
      color: OSCURO,
      bold: true,
      lines: 2,
      valign: "middle",
    }),
    foto("f1", 1, 48, 460, 620, 940, { cornerRadius: 24 }),
    foto("f2", 2, 684, 460, 348, 300, { cornerRadius: 24 }),
    foto("f3", 3, 684, 780, 348, 300, { cornerRadius: 24 }),
    foto("f4", 4, 684, 1100, 348, 300, { cornerRadius: 24 }),
    ...pie(OSCURO),
  ]),
};

export const STORY_COLLAGES: readonly StoryCollage[] = [GRILLA, PROTAGONISTA, INSTANTANEAS, TIRA, MOSAICO];

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
